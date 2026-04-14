"""
Run this script ONCE to build (or rebuild) the FAISS vector index.

Usage:
    python build_vector_store.py

The index is saved to the path defined in FAISS_INDEX_PATH (default: faiss_index/).
The service loads it at startup — it is never rebuilt at runtime.
"""
import os
from dotenv import load_dotenv

load_dotenv()

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from pdf_loader import load_pdfs
from web_loader import load_web_data

DATA_PATH = os.getenv("DATA_PATH", "data")
FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "faiss_index")

print("Loading PDF documents...")
pdf_docs = load_pdfs(DATA_PATH)
print(f"  Loaded PDF pages : {len(pdf_docs)}")

print("Loading web documents...")
web_docs = load_web_data()
print(f"  Loaded web docs  : {len(web_docs)}")

splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
pdf_chunks = splitter.split_documents(pdf_docs)
web_chunks = splitter.split_documents(web_docs)

print(f"  PDF chunks  : {len(pdf_chunks)}")
print(f"  Web chunks  : {len(web_chunks)}")
print(f"  Total chunks: {len(pdf_chunks) + len(web_chunks)}")

for c in pdf_chunks:
    c.metadata["source_type"] = "pdf"
    c.metadata["reliability"] = 1.0

for c in web_chunks:
    c.metadata["source_type"] = "web"

chunks = pdf_chunks + web_chunks

print("Building FAISS index (this may take a few minutes)...")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_db = FAISS.from_documents(chunks, embeddings)
vector_db.save_local(FAISS_INDEX_PATH)

print(f"\n✅ Vector index saved to '{FAISS_INDEX_PATH}/'")
