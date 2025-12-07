import sys
import os
import time
import requests
import argparse
from pathlib import Path
from libzim.reader import Archive
from libzim.search import Query, Searcher
from strip_tags import strip_tags

# --- Configuration ---
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "qwen3:1.7b"  # User's specific model

def generate_search_queries(question):
    print("Generating search queries...")
    prompt = f"""Task: Act as a Wikipedia Librarian. Convert the user's natural language question into 5 precise Wikipedia search terms.
    
    Rules:
    1. First Query: The most likely exact article title.
    2. Second Query: A simple noun phrase.
    3. Third Query: A broader category.
    4. Fourth Query: A related technical term.
    5. Fifth Query: A synonym or alternative phrasing.
    NO boolean operators. Just phrases.
    
    User: \"How do I tell time without a clock?\"
    Output:
    Sundial
    Sun dial
    Timekeeping
    Shadow clock
    Orientation (geometry)
    
    User: \"{question}\"\n    Output:"""

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        content = response.json()['message']['content'].strip()
        queries = [line.strip().replace('"', '').replace('-', '').strip() for line in content.split('\n') if line.strip()]
        queries = queries[:5]
        print(f"Generated Queries: {queries}")
        return queries
    except Exception as e:
        print(f"Error generating queries: {e}")
        return [question]

def search_zim_raw(zim_path, query_text, limit=5):
    # Helper to get raw results with fallback
    try:
        zim = Archive(Path(zim_path))
        searcher = Searcher(zim)
        
        # Try exact phrase first
        query = Query().set_query(query_text)
        search = searcher.search(query)
        results = list(search.getResults(0, limit))
        
        if not results and " " in query_text:
            # Fallback: Split into keywords (Implicit OR/AND depending on libzim default, usually AND-ish)
            pass
            
        return results
    except:
        return []

def rerank_results(question, candidates):
    print(f"Re-ranking {len(candidates)} candidates...")
    if not candidates:
        return []
    
    # If we have very few candidates, just return them all (skip LLM)
    if len(candidates) <= 3:
        return candidates

    candidates_str = "\n".join(candidates)
    
    prompt = f"""Task: Select the top 3 most relevant Wikipedia article titles from the list below.
    
    User Question: \"{question}\"\n    
    Candidate Articles:
    {candidates_str}
    
    Output: Return ONLY the exact titles of the 3 best articles.
    """

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        content = response.json()['message']['content'].strip()
        
        best_picks = []
        for line in content.split('\n'):
            clean_line = line.strip().replace('"', '').replace('*', '').strip()
            for cand in candidates:
                if clean_line in cand or cand in clean_line:
                    if cand not in best_picks:
                        best_picks.append(cand)
        
        if not best_picks:
            print("LLM re-ranking yielded nothing, falling back to top raw results.")
            return candidates[:3]
            
        print(f"Selected Best Articles: {best_picks[:3]}")
        return best_picks[:3]
        
    except Exception as e:
        print(f"Error during re-ranking: {e}")
        return candidates[:3]

def read_article(zim_path, article_path):
    print(f"Reading article: {article_path}...")
    try:
        zim = Archive(Path(zim_path))
        entry = zim.get_entry_by_path(article_path)
        html_content = bytes(entry.get_item().content).decode("UTF-8")
        # Minify and clean
        text = strip_tags(html_content, minify=True, remove_blank_lines=True)
        # OPTIMIZATION: Return only the first 6000 chars (approx 1.5k tokens).
        # This captures the intro and key details without overloading the CPU.
        return text[:6000]
    except Exception as e:
        print(f"Error reading article: {e}")
        return ""

def query_ollama(context, question):
    print(f"Querying Ollama ({MODEL_NAME})...")
    
    # OPTIMIZATION: Limit total context to 12000 chars (~3000 tokens)
    # This targets a ~30-45s processing time on modern CPUs.
    truncated_context = context[:12000] 
    
    prompt = f"""You are a helpful assistant. Answer the user's question using the provided context.
    
    Context:
    {truncated_context}
    
    Question: {question}
    
    Answer:"""

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    
    start_time = time.time()
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        end_time = time.time()
        inference_time = end_time - start_time
        print(f"Ollama Inference Time: {inference_time:.2f} seconds")
        return response.json()['message']['content']
    except Exception as e:
        return f"Error querying Ollama: {e}"

def main():
    if len(sys.argv) < 3:
        print("Usage: python test_kiwix_ai.py <path_to_zim_file> <question>")
        sys.exit(1)

    zim_path = sys.argv[1]
    question = sys.argv[2]

    if not os.path.exists(zim_path):
        print(f"Error: File not found at {zim_path}")
        sys.exit(1)

    # 1. Generate Queries
    queries = generate_search_queries(question)
    
    # 2. Search & Aggregate
    all_candidates = []
    for q in queries:
        results = search_zim_raw(zim_path, q, limit=5)
        for res in results:
            if res not in all_candidates:
                all_candidates.append(res)
    
    if not all_candidates:
        print("Smart queries returned nothing. Trying raw question...")
        all_candidates = search_zim_raw(zim_path, question, limit=10)

    if not all_candidates:
        print("No articles found.")
        sys.exit(0)

    # 3. Re-rank
    top_articles = rerank_results(question, all_candidates)

    # 4. Read & Aggregate Content
    # OPTIMIZATION: Only take top 2 articles to save tokens
    top_articles = top_articles[:2]
    
    full_context = ""
    for path in top_articles:
        content = read_article(zim_path, path)
        if content:
            full_context += f"\n\n--- Article: {path} ---\n{content}"

    if not full_context:
        print("Could not extract content.")
        sys.exit(1)

    # 5. AI Answer
    print("\n--- Generative Answer ---")
    answer = query_ollama(full_context, question)
    print(answer)
    print("-------------------------")

if __name__ == "__main__":
    main()