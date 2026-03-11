'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { saveProject } from "@/lib/projectStorage";

export default function ConnectPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [connectionString, setConnectionString] = useState("");
    const [projectName, setProjectName] = useState("");
    const [activeTab, setActiveTab] = useState<"connection" | "file" | "ai" | "github">("connection");
    const [file, setFile] = useState<File | null>(null);
    const [aiDescription, setAiDescription] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        let res;
        try {
            if (activeTab === "connection") {
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        connection_string: connectionString,
                        project_name: projectName || "My Project"
                    }),
                });
            } else if (activeTab === "file") {
                if (!file) {
                    throw new Error("Please select a SQL file.");
                }
                const formData = new FormData();
                formData.append("file", file);
                formData.append("project_name", projectName || "My Project");

                const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/upload-sql`);
                url.searchParams.append("project_name", projectName || "My Project");

                res = await fetch(url.toString(), {
                    method: "POST",
                    body: formData,
                });
            } else if (activeTab === "ai") {
                // AI Generation
                if (!aiDescription) {
                    throw new Error("Please enter a description.");
                }
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/generate-schema`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        description: aiDescription,
                        project_name: projectName || "AI Generated Project"
                    }),
                });
            } else {
                // GitHub Import
                if (!githubUrl) {
                    throw new Error("Please enter a GitHub URL.");
                }
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/import-github`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        github_url: githubUrl,
                        project_name: projectName || "GitHub Import"
                    }),
                });
            }

            if (!res || !res.ok) {
                const data = res ? await res.json() : {};
                throw new Error(data.detail || "Failed to connect");
            }

            const data = await res.json();

            // Store connection info
            const defaultNames: Record<string, string> = { connection: "My Project", file: "My Project", ai: "AI Generated Project", github: "GitHub Import" };
            localStorage.setItem("project_name", projectName || defaultNames[activeTab]);
            if (activeTab === "connection") {
                localStorage.setItem("db_connection_string", connectionString);
            } else {
                // For File Upload, AI, and GitHub, we use the internal Shadow DB
                localStorage.setItem("db_connection_string", "SHADOW_DB");
            }

            const finalConnStr = activeTab === "connection" ? connectionString : "SHADOW_DB";
            localStorage.setItem("db_connection_string", finalConnStr);

            // Persist to Firestore if user is signed in
            if (user) {
                let sqlContent = "";
                // For file uploads, read the file content
                if (activeTab === "file" && file) {
                    try { sqlContent = await file.text(); } catch { }
                } else if (activeTab === "ai") {
                    sqlContent = aiDescription; // store description as reference
                } else if (activeTab === "github") {
                    sqlContent = githubUrl; // store URL as reference; backend saved the SQL
                }
                try {
                    // Temporarily bypassed for local testing to avoid Firestore permission errors
                    // await saveProject(user.uid, {
                    //    projectName: projectName || defaultNames[activeTab],
                    //    connectionType: activeTab,
                    //    sqlContent,
                    //    connectionString: finalConnStr,
                    // });
                    console.log("Mock saved project locally:", projectName);
                } catch (e) {
                    console.warn("Could not save project to Firestore:", e);
                }
            }

            console.log("Success:", data);
            router.push("/dashboard");

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Card className="w-[450px]">
                <CardHeader>
                    <CardTitle>Connect Database</CardTitle>
                    <CardDescription>
                        Connect to a live database, upload a SQL schema, or generate one with AI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex space-x-4 mb-6 border-b pb-2">
                        <button
                            className={`pb-2 text-sm font-medium transition-colors ${activeTab === "connection"
                                ? "border-b-2 border-primary text-primary"
                                : "text-muted-foreground hover:text-primary"
                                }`}
                            onClick={() => setActiveTab("connection")}
                            type="button"
                        >
                            Connection String
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium transition-colors ${activeTab === "file"
                                ? "border-b-2 border-primary text-primary"
                                : "text-muted-foreground hover:text-primary"
                                }`}
                            onClick={() => setActiveTab("file")}
                            type="button"
                        >
                            Upload SQL File
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium transition-colors ${activeTab === "ai"
                                ? "border-b-2 border-primary text-primary"
                                : "text-muted-foreground hover:text-primary"
                                }`}
                            onClick={() => setActiveTab("ai")}
                            type="button"
                        >
                            Generate with AI
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium transition-colors ${activeTab === "github"
                                ? "border-b-2 border-primary text-primary"
                                : "text-muted-foreground hover:text-primary"
                                }`}
                            onClick={() => setActiveTab("github")}
                            type="button"
                        >
                            GitHub Link
                        </button>
                    </div>

                    <form onSubmit={handleConnect} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project">Project Name</Label>
                            <Input
                                id="project"
                                placeholder="My Awesome App"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                            />
                        </div>

                        {activeTab === "connection" ? (
                            <div className="space-y-2" key="connection-tab">
                                <Label htmlFor="connection">Connection String</Label>
                                <Input
                                    id="connection"
                                    placeholder="postgresql://user:pass@host:5432/db"
                                    value={connectionString || ""}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                    required={activeTab === "connection"}
                                />
                            </div>
                        ) : activeTab === "file" ? (
                            <div className="space-y-2" key="file-tab">
                                <Label htmlFor="file">SQL File</Label>
                                <Input
                                    id="file"
                                    type="file"
                                    accept=".sql"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    required={activeTab === "file"}
                                    value={undefined} // Explicitly undefined for uncontrolled file input
                                />
                                <p className="text-xs text-muted-foreground">
                                    Upload a .sql file containing your database schema.
                                </p>
                            </div>
                        ) : activeTab === "ai" ? (
                            <div className="space-y-2" key="ai-tab">
                                <Label htmlFor="ai-desc">Describe your database</Label>
                                <textarea
                                    id="ai-desc"
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="e.g., A library system with books, authors, and members. Books have ISBNs and references to authors."
                                    value={aiDescription || ""}
                                    onChange={(e) => setAiDescription(e.target.value)}
                                    required={activeTab === "ai"}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Our AI will generate a SQL schema based on your description.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2" key="github-tab">
                                <Label htmlFor="github-url">GitHub File URL</Label>
                                <Input
                                    id="github-url"
                                    placeholder="https://github.com/user/repo/blob/main/schema.sql"
                                    value={githubUrl || ""}
                                    onChange={(e) => setGithubUrl(e.target.value)}
                                    required={activeTab === "github"}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste a link to a public <code>.sql</code> file on GitHub. Both blob and raw URLs are supported.
                                </p>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Processing..." : (
                                activeTab === "connection" ? "Connect & Scan" :
                                    activeTab === "file" ? "Upload & Scan" :
                                        activeTab === "ai" ? "Generate & Scan" :
                                            "Import & Scan"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
