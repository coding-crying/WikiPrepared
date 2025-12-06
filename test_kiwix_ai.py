import sys
import os
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
    prompt = f"""Task: Act as a Wikipedia Librarian. Convert the user's natural language question into 3 precise Wikipedia search terms.
    
    Rules:
    1. First Query: The most likely exact article title (often a technical term).
    2. Second Query: A simple noun phrase describing the core object.
    3. Third Query: The broader category or field.
    4. NO boolean operators (AND, OR, +). NO sentences. Just phrases.
    
    Examples:
    User: "How do I sew up a deep cut?"
    Output:
    Surgical suture
    Wound closure
    Emergency medicine
    
    User: "How do I make a campfire?"
    Output:
    Campfire
    Fire making
    Survival skills
    
    User: "How to wrap copper wire for a generator?"
    Output:
    Electromagnetic coil
    Inductor
    Solenoid
    
    User: "{question}"
    Output:"""

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        content = response.json()['message']['content'].strip()
        # Split by newline and clean
        queries = [line.strip().replace('"', '').replace('-', '').strip() for line in content.split('\n') if line.strip()]
        # Take top 3
        queries = queries[:3]
        print(f"Generated Queries: {queries}")
        return queries
    except Exception as e:
        print(f"Error generating queries: {e}")
        return [question]

def rerank_results(question, candidates):
    print(f"Re-ranking {len(candidates)} candidates...")
    if not candidates:
        return []
        
    candidates_str = "\n".join(candidates)
    
    prompt = f"""Task: Select the top 3 most relevant Wikipedia article titles from the list below that would best answer the user's question.
    
    User Question: \"{question}\"\n    
    Candidate Articles:
    {candidates_str}
    
    Output: Return ONLY the exact titles of the 3 best articles, one per line. If none are good, pick the closest ones.
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
        
        # Naive parsing: look for lines that exist in the candidates list
        best_picks = []
        for line in content.split('\n'):
            clean_line = line.strip().replace('"', '').replace('*', '').strip()
            # Fuzzy match or exact match check
            for cand in candidates:
                if clean_line in cand or cand in clean_line:
                    if cand not in best_picks:
                        best_picks.append(cand)
        
        # If LLM failed to return valid lines, fall back to top 3 original candidates
        if not best_picks:
            print("LLM re-ranking vague, falling back to search order.")
            return candidates[:3]
            
        print(f"Selected Best Articles: {best_picks[:3]}")
        return best_picks[:3]
        
    except Exception as e:
        print(f"Error during re-ranking: {e}")
        return candidates[:3]

def search_zim_raw(zim_path, query_text, limit=5):
    # Helper to get raw results without printing
    try:
        zim = Archive(Path(zim_path))
        searcher = Searcher(zim)
        query = Query().set_query(query_text)
        search = searcher.search(query)
        return list(search.getResults(0, limit))
    except:
        return []

def read_article(zim_path, article_path):
    print(f"Reading article: {article_path}...")
    try:
        zim = Archive(Path(zim_path))
        entry = zim.get_entry_by_path(article_path)
        html_content = bytes(entry.get_item().content).decode("UTF-8")
        # Minify and clean
        text = strip_tags(html_content, minify=True, remove_blank_lines=True)
        return text
    except Exception as e:
        print(f"Error reading article: {e}")
        return ""

def query_ollama(context, question):
    print(f"Querying Ollama ({MODEL_NAME})...")
    
    # Limit total context to avoid crashing small models (approx 8k tokens safe-ish)
    truncated_context = context[:25000] 
    
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
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
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
        # Fallback to original question
        print("Smart queries returned nothing. Trying raw question...")
        all_candidates = search_zim_raw(zim_path, question, limit=10)

    if not all_candidates:
        print("No articles found.")
        sys.exit(0)

    # 3. Re-rank
    top_articles = rerank_results(question, all_candidates)

    # 4. Read & Aggregate Content
    full_context = ""
    for path in top_articles:
        content = read_article(zim_path, path)
        if content:
            full_context += f"\n\n--- Article: {path} ---\n{content[:5000]}" # Limit per article to save context

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
