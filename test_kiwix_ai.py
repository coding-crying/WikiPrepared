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

def extract_keywords(question):
    print("Extracting search keywords...")
    prompt = f"""Task: Convert the user's question into a single, specific Wikipedia article title or search phrase. 
    Do not answer the question. Just provide the best search term.
    
    Examples:
    User: "How do I make a campfire?" -> Campfire
    User: "Who was the first president?" -> List of presidents of the United States
    User: "What is the capital of France?" -> Paris
    User: "Tell me about quantum physics" -> Quantum mechanics
    
    User: "{question}"
    Search Term:"""

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        keywords = response.json()['message']['content'].strip()
        # Clean up if the model is chatty (remove quotes, etc)
        keywords = keywords.replace('"', '').replace("'", "").split('\n')[0]
        print(f"Smart Search Query: '{keywords}'")
        return keywords
    except Exception as e:
        print(f"Error extracting keywords: {e}")
        return question # Fallback to original

def search_zim(zim_path, query_text):
    print(f"Searching ZIM file: {zim_path} for '{query_text}'...")
    try:
        zim = Archive(Path(zim_path))
    except Exception as e:
        print(f"Error opening ZIM file: {e}")
        return None

    searcher = Searcher(zim)
    query = Query().set_query(query_text)
    search = searcher.search(query)
    
    count = search.getEstimatedMatches()
    print(f"Found {count} estimated matches.")
    
    if count == 0:
        return []

    # Get top 3 results
    results_limit = 3
    results = list(search.getResults(0, results_limit))
    
    if not results:
        return []
        
    print(f"--- Top {len(results)} Search Results ---")
    for i, res in enumerate(results):
        print(f"{i+1}. {res}")
    print("--------------------------------")
    
    return results

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

    # 1. Smart Search
    # First, get a better search term
    search_term = extract_keywords(question)
    
    # Then search with that term
    article_paths = search_zim(zim_path, search_term)
    
    # If smart search fails, try original question as fallback
    if not article_paths and search_term != question:
        print("Smart search failed, trying original question...")
        article_paths = search_zim(zim_path, question)
        
    if not article_paths:
        print("No relevant articles found in ZIM file.")
        sys.exit(0)

    # 2. Read & Aggregate
    full_context = ""
    for path in article_paths:
        content = read_article(zim_path, path)
        if content:
            full_context += f"\n\n--- Article: {path} ---\n{content}"

    if not full_context:
        print("Could not extract content.")
        sys.exit(1)

    # 3. AI Answer
    print("\n--- Generative Answer ---")
    answer = query_ollama(full_context, question)
    print(answer)
    print("-------------------------")

if __name__ == "__main__":
    main()