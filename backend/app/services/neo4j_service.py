import logging
from neo4j import GraphDatabase, exceptions

logger = logging.getLogger(__name__)

class Neo4jService:
    def __init__(self, uri: str, user: str = None, password: str = None):
        self.uri = uri
        self.user = user
        self.password = password
        
        auth = (user, password) if user and password else None
        self.driver = GraphDatabase.driver(uri, auth=auth)

    def close(self):
        self.driver.close()

    @staticmethod
    def verify_connection(uri: str, user: str = None, password: str = None) -> bool:
        """
        Attempts to connect to the Neo4j instance and verifies connectivity.
        """
        try:
            auth = (user, password) if user and password else None
            driver = GraphDatabase.driver(uri, auth=auth)
            driver.verify_connectivity()
            driver.close()
            return True
        except Exception as e:
            logger.error(f"Failed to verify Neo4j connection: {e}")
            return False

    def get_node_count(self) -> int:
        """
        Returns the total number of nodes in the graph database.
        """
        query = "MATCH (n) RETURN count(n) AS node_count"
        try:
            with self.driver.session() as session:
                result = session.run(query)
                record = result.single()
                if record:
                    return record["node_count"]
                return 0
        except Exception as e:
            logger.error(f"Failed to get Node count: {e}")
            return 0
    
    def get_relationship_count(self) -> int:
        """
        Returns the total number of relationships in the graph database.
        """
        query = "MATCH ()-[r]->() RETURN count(r) AS rel_count"
        try:
            with self.driver.session() as session:
                result = session.run(query)
                record = result.single()
                if record:
                    return record["rel_count"]
                return 0
        except Exception as e:
            logger.error(f"Failed to get Relationship count: {e}")
            return 0
