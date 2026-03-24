import psycopg2

try:
    conn = psycopg2.connect("postgresql://postgres:root@127.0.0.1:5432/postgres")
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    dbs = [row[0] for row in cur.fetchall()]
    print("DATABASES:", dbs)
    if "shadow_db" in dbs:
        print("YES! shadow_db is present.")
    else:
        print("NO. shadow_db is missing.")
except Exception as e:
    print("Failed to connect:", e)
