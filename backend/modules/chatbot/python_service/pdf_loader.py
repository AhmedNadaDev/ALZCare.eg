from langchain_community.document_loaders import PyPDFLoader
import os


def load_pdfs(folder_path: str) -> list:
    """Recursively load all PDFs from a folder."""
    all_docs = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.endswith(".pdf"):
                file_path = os.path.join(root, file)
                loader = PyPDFLoader(file_path)
                all_docs.extend(loader.load())
    return all_docs
