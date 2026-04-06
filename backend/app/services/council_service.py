import logging
from typing import List, Dict, Any
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

class CouncilService:
    def __init__(self):
        self.ai_service = AIService()

    async def deliberate(self, request: str, schema_context: str) -> Dict[str, Any]:
        """
        Simulates a council debate between 'The Architect' and 'The Guardian' to ensure 
        database changes are both performant and secure.
        """
        transcript = []

        try:
            # 1. The Architect Proposes
            architect_prompt = f"""You are 'The Architect', an expert PostgreSQL database designer focused on performance and scale.
Propose a high-level solution (no SQL yet) for the following request, given the schema. Keep it to 2 concise sentences.
Schema Context: {schema_context}
User Request: {request}"""
            
            architect_msg = [
                {"role": "system", "content": "You are The Architect. Focus on normalization, indexing, and speed."}, 
                {"role": "user", "content": architect_prompt}
            ]
            proposal = await self.ai_service._call_ai(architect_msg, max_tokens=200, temperature=0.7)
            transcript.append({"agent": "Architect", "message": proposal})

            # 2. The Guardian Reviews
            guardian_prompt = f"""You are 'The Guardian', an expert in Database Security, PII compliance, and data integrity.
Review The Architect's proposal below. Point out 1 potential security, scaling, privacy, or data-loss risk. If it is perfectly safe, just commend it. Keep it to 2 concise sentences.
User Request: {request}
Architect's Proposal: {proposal}"""
            
            guardian_msg = [
                {"role": "system", "content": "You are The Guardian. Be paranoid about PII, accidental data drops, and unauthorized access."}, 
                {"role": "user", "content": guardian_prompt}
            ]
            review = await self.ai_service._call_ai(guardian_msg, max_tokens=200, temperature=0.7)
            transcript.append({"agent": "Guardian", "message": review})
            
            # 3. Final Consensus SQL
            consensus_prompt = f"""Based on the User Request, the Architect's Design, and the Guardian's Security Review, generate the final, safe PostgreSQL DDL/SQL.
Return ONLY valid SQL. No markdown wrappers. No explanations.
User Request: {request}
Architect's Design: {proposal}
Guardian's Constraints: {review}
Schema Context: {schema_context}"""
            
            consensus_msg = [
                {"role": "system", "content": "You are the Executive SQL Generator. Output ONLY valid PostgreSQL SQL, never text or markdown blocks."}, 
                {"role": "user", "content": consensus_prompt}
            ]
            sql = await self.ai_service._call_ai(consensus_msg, max_tokens=800, temperature=0.1)
            
            # Clean possible markdown block
            sql = sql.strip()
            if sql.startswith("```sql"):
                sql = sql[6:]
            elif sql.startswith("```"):
                sql = sql[3:]
            if sql.endswith("```"):
                sql = sql[:-3]
            
            return {
                "transcript": transcript,
                "final_sql": sql.strip()
            }
        except Exception as e:
            logger.error(f"Council deliberation failed: {e}")
            return {
                "transcript": [{"agent": "System", "message": f"The Council experienced an error: {str(e)}"}],
                "final_sql": ""
            }
