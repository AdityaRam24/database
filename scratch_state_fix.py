import os
import re

def process_qb():
    path = r"c:\Users\Aniket\database\frontend\src\app\dashboard\query-builder\page.tsx"
    with open(path, "r", encoding="utf-8") as f: content = f.read()
    
    if "sessionStorage.getItem(\"qb_sql\")" not in content:
        insert_code = """
  useEffect(() => {
    const s = sessionStorage.getItem("qb_sql"); if(s) setSql(s);
    const p = sessionStorage.getItem("qb_prompt"); if(p) setPrompt(p);
    const r = sessionStorage.getItem("qb_result"); if(r) try { setResult(JSON.parse(r)); } catch {}
  }, []);
  useEffect(() => { sessionStorage.setItem("qb_sql", sql); }, [sql]);
  useEffect(() => { sessionStorage.setItem("qb_prompt", prompt); }, [prompt]);
  useEffect(() => { if(result) sessionStorage.setItem("qb_result", JSON.stringify(result)); else sessionStorage.removeItem("qb_result"); }, [result]);
"""
        content = content.replace("  const analyzeQuery = async () => {", insert_code + "\n  const analyzeQuery = async () => {")
        with open(path, "w", encoding="utf-8") as f: f.write(content)

def process_gov():
    path = r"c:\Users\Aniket\database\frontend\src\app\dashboard\governance\page.tsx"
    with open(path, "r", encoding="utf-8") as f: content = f.read()

    if "sessionStorage.getItem(\"gov_sql\")" not in content:
        insert_code = """
    useEffect(() => {
        const s = sessionStorage.getItem("gov_sql"); if(s) setSqlPatch(s);
        const n = sessionStorage.getItem("gov_nl"); if(n) setNlDescription(n);
    }, []);
    useEffect(() => { sessionStorage.setItem("gov_sql", sqlPatch); }, [sqlPatch]);
    useEffect(() => { sessionStorage.setItem("gov_nl", nlDescription); }, [nlDescription]);
"""
        content = content.replace("    const saveHistory = (item: HistoryItem) => {", insert_code + "\n    const saveHistory = (item: HistoryItem) => {")
        with open(path, "w", encoding="utf-8") as f: f.write(content)

def process_ai():
    path = r"c:\Users\Aniket\database\frontend\src\app\dashboard\ai\page.tsx"
    with open(path, "r", encoding="utf-8") as f: content = f.read()

    if "sessionStorage.getItem(\"ai_input\")" not in content:
        insert_code = """
    useEffect(() => {
        const s = sessionStorage.getItem("ai_input"); if(s) setInput(s);
        const m = sessionStorage.getItem("ai_messages"); if(m) try { const parsed = JSON.parse(m); if(parsed.length) setMessages(parsed); } catch {}
    }, []);
    useEffect(() => { sessionStorage.setItem("ai_input", input); }, [input]);
    useEffect(() => { if(messages.length) sessionStorage.setItem("ai_messages", JSON.stringify(messages)); else sessionStorage.removeItem("ai_messages"); }, [messages]);
"""
        content = content.replace("    /* Welcome message */", insert_code + "\n    /* Welcome message */")

        # Fix welcome message so it doesn't overwrite
        old_welcome = """    /* Welcome message */
    useEffect(() => {
        if (connectionString) {
            setMessages([{
                id: 'welcome',
                role: 'ai',
                content: `👋 Hey there! I'm **Lumina**, your friendly database guide!\\n\\nI'm connected to your database and ready to help. Think of me as a super-smart friend who can look inside your data and explain everything in everyday language — no tech skills needed!\\n\\nYou can:\\n• Type your question in the box below\\n• 🎤 Tap the microphone and just speak to me\\n• 🔊 Enable my voice so I can talk back to you\\n\\nIn short: I make databases easy and fun to understand! 🚀`,
                query_result: null,
            }]);
        }
    }, [connectionString]);"""
        
        new_welcome = """    /* Welcome message */
    useEffect(() => {
        if (connectionString) {
            setMessages(prev => {
                if (prev.length > 0) return prev;
                return [{
                    id: 'welcome',
                    role: 'ai',
                    content: `👋 Hey there! I'm **Lumina**, your friendly database guide!\\n\\nI'm connected to your database and ready to help. Think of me as a super-smart friend who can look inside your data and explain everything in everyday language — no tech skills needed!\\n\\nYou can:\\n• Type your question in the box below\\n• 🎤 Tap the microphone and just speak to me\\n• 🔊 Enable my voice so I can talk back to you\\n\\nIn short: I make databases easy and fun to understand! 🚀`,
                    query_result: null,
                }];
            });
        }
    }, [connectionString]);"""
        
        content = content.replace(old_welcome, new_welcome)
        
        # Modify clearChat to also clear sessionStorage
        content = content.replace(
            "const clearChat = () => setMessages(connectionString ? [{ id: genId(), role: 'ai', content: '🧹 Chat cleared! What would you like to explore next?', query_result: null }] : []);",
            "const clearChat = () => { sessionStorage.removeItem('ai_messages'); setMessages(connectionString ? [{ id: genId(), role: 'ai', content: '🧹 Chat cleared! What would you like to explore next?', query_result: null }] as any : []); };"
        )
        
        with open(path, "w", encoding="utf-8") as f: f.write(content)

process_qb()
process_gov()
process_ai()
print("State sync applied successfully.")
