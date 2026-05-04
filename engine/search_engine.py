from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, STORED
from whoosh.qparser import QueryParser, FuzzyTermPlugin
import os

class SearchEngine:
    def __init__(self, index_dir="index_db"):
        self.index_dir = index_dir
        self.schema = Schema(
            filename=ID(stored=True),
            path=ID(stored=True, unique=True),
            content=TEXT(stored=True, analyzer=None), # analyzer=None for raw Arabic handling
            timestamp=STORED
        )
        
        if not os.path.exists(self.index_dir):
            os.mkdir(self.index_dir)
            self.ix = create_in(self.index_dir, self.schema)
        else:
            self.ix = open_dir(self.index_dir)

    def add_document(self, filename, path, content, timestamp):
        writer = self.ix.writer()
        writer.update_document(
            filename=filename,
            path=path,
            content=content,
            timestamp=timestamp
        )
        writer.commit()

    def search(self, query_str, limit=10):
        results_list = []
        with self.ix.searcher() as searcher:
            parser = QueryParser("content", self.ix.schema)
            parser.plugin_with_score = True
            # Allow fuzzy search for handwriting inaccuracies
            parser.add_plugin(FuzzyTermPlugin())
            
            # Append ~ to words for fuzzy search automatically if not present
            processed_query = " ".join([f"{word}~" if "~" not in word else word for word in query_str.split()])
            query = parser.parse(processed_query)
            
            results = searcher.search(query, limit=limit)
            for hit in results:
                results_list.append({
                    "filename": hit['filename'],
                    "path": hit['path'],
                    "content": hit['content'],
                    "score": hit.score
                })
        return results_list
