import asyncio
import sys
sys.path.append('c:/Users/Aniket/database/backend')

from app.services.ai_service import AIService

async def test():
    svc = AIService()
    schema = '''
    Table: Customer
    Columns: customerID, name, customerAddress, phone, password, userName, dateSignUp, cardNumber
    '''
    question = 'Active User'
    rules = 'CRITICAL DOMAIN KNOWLEDGE:\nTERM: "Active User" -> DEFINITION: A user who has logged in within the last 7 days'
    ans = await svc.answer_database_question(question, schema, language='english', business_rules=rules)
    print("---------------- ANSWER ----------------")
    print(ans)

asyncio.run(test())
