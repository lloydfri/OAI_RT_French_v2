import { useEffect, useState } from "react";

const functionDescription = `
Call this function when a user gives you an URL, implicitly asking you to have a conversation about the article on that URL.
`;

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "display_article",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            url: {
              type: "string",
              description: "URL of the article to fetch and display.",
            },
          },
          required: ["url"],
        },
      },
    ],
    tool_choice: "auto"
  },
};

function ArticleContent({ functionCallOutput, onArticleReady }) {
  const { url } = JSON.parse(functionCallOutput.arguments);
  const [articleContent, setArticleContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSent, setDataSent] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        setDataSent(false); // Reset data sent flag when fetching a new URL
        
        // Use the server-side proxy to avoid CORS issues
        const proxyUrl = `/api/fetch-article?url=${encodeURIComponent(url)}`;
        
        try {
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          
          const html = await response.text();
          
          // Basic extraction of text content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          
          // Remove scripts, styles, and other non-content elements
          const scripts = tempDiv.getElementsByTagName('script');
          const styles = tempDiv.getElementsByTagName('style');
          
          while (scripts.length > 0) {
            scripts[0].parentNode.removeChild(scripts[0]);
          }
          
          while (styles.length > 0) {
            styles[0].parentNode.removeChild(styles[0]);
          }
          
          // Try to find main content (this is a simple approach)
          let content = '';
          const article = tempDiv.querySelector('article') || 
                          tempDiv.querySelector('main') || 
                          tempDiv.querySelector('.content') ||
                          tempDiv.querySelector('.article');
                          
          if (article) {
            content = article.textContent;
          } else {
            // Fallback to body content
            content = tempDiv.textContent;
          }
          
          // Clean up the text (basic)
          content = content.replace(/\s+/g, ' ').trim();
          setArticleContent(content);
        } catch (fetchError) {
          setError(`Failed to fetch article: ${fetchError.message}`);
          
          // Set minimal content so we can still continue
          setArticleContent(
            `Unable to fetch content from ${url}. Please try a different URL or check if the website is accessible.`
          );
        }
      } catch (err) {
        setError("Failed to process article: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (url) {
      fetchArticle();
    }
  }, [url]);

  // Pass the article content back to the server when it's ready
  useEffect(() => {
    if (!isLoading && url && !dataSent) {
      // Create a JSON object representing the article content
      const articleData = {
        url: url,
        content: articleContent,
        fetchSuccessful: !error,
        timestamp: new Date().toISOString()
      };
      
      onArticleReady(articleData);
      setDataSent(true);
    }
  }, [isLoading, url, articleContent, error, onArticleReady, dataSent]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-md font-semibold">Article from: {url}</h3>
      
      {isLoading && <p>Loading article content...</p>}
      
      {error && (
        <div className="text-red-500 bg-red-50 p-2 rounded-md mb-2">
          {error}
        </div>
      )}
      
      {!isLoading && (
        <div className="overflow-y-auto max-h-[500px] bg-white p-4 rounded-md border border-gray-200">
          <div className="article-content whitespace-pre-wrap">
            {articleContent || "No content could be extracted from the URL."}
          </div>
        </div>
      )}
      
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ArticlePanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [articleData, setArticleData] = useState(null);

  // Register tool when session becomes active
  useEffect(() => {
    if (isSessionActive && !functionAdded) {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setArticleData(null);
    }
  }, [isSessionActive, functionAdded, sendClientEvent]);

  // Process events to detect function calls
  useEffect(() => {
    if (!events || events.length === 0) return;

    const mostRecentEvent = events[0];
    
    // Check for function_call in response.done events
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response?.output
    ) {
      const displayArticleCalls = mostRecentEvent.response.output.filter(
        output => output.type === "function_call" && output.name === "display_article"
      );
      
      if (displayArticleCalls.length > 0 && !functionCallOutput) {
        setFunctionCallOutput(displayArticleCalls[0]);
      }
    }
    
    // Check for tool_calls in response.update events
    if (mostRecentEvent.type === "response.update" && 
        mostRecentEvent.response?.content &&
        !functionCallOutput) {
      const content = mostRecentEvent.response.content;
      if (Array.isArray(content)) {
        const toolCalls = content.filter(item => item.type === "tool_calls");
        
        if (toolCalls.length > 0) {
          let foundToolCall = false;
          
          // Look through all tool calls for display_article
          for (const toolCall of toolCalls) {
            if (!toolCall.tool_calls) continue;
            
            for (const call of toolCall.tool_calls) {
              if (call.function.name === "display_article") {
                try {
                  const args = JSON.parse(call.function.arguments);
                  const output = {
                    type: "function_call",
                    name: "display_article",
                    arguments: JSON.stringify(args)
                  };
                  
                  setFunctionCallOutput(output);
                  foundToolCall = true;
                  break;
                } catch (e) {
                  console.error("Error parsing tool call arguments");
                }
              }
            }
            
            if (foundToolCall) break;
          }
        }
      }
    }
  }, [events, functionCallOutput]);

  // Manual testing functions
  const testUrl = (url) => {
    if (!url.trim()) return;
    
    const output = {
      type: "function_call",
      name: "display_article",
      arguments: JSON.stringify({ url: url.trim() })
    };
    setFunctionCallOutput(output);
  };

  // Handler to be called when article content is ready
  const handleArticleReady = (data) => {
    // Only update articleData and send event if it's changed
    if (JSON.stringify(articleData) !== JSON.stringify(data)) {
      setArticleData(data);
      
      // Send the article data back to the server
      setTimeout(() => {
        sendClientEvent({
          type: "response.create",
          response: {
            instructions: `
            continue the conversation about the article from ${data.url}.
            Here is the content of the article for context: ${data.content.substring(0, 1000)}${data.content.length > 1000 ? '...' : ''}
          `,
          },
        });
      }, 500);
    }
  };

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Article Panel</h2>
        {isSessionActive ? (
          functionCallOutput ? (
            <ArticleContent 
              functionCallOutput={functionCallOutput} 
              onArticleReady={handleArticleReady}
            />
          ) : (
            <div className="space-y-4">
              <p>Provide a URL to an article to discuss...</p>
              
              {/* Manual testing form */}
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">Testing: Manually enter a URL</p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Enter URL to test"
                    className="border border-gray-300 rounded-md p-2 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        testUrl(e.target.value.trim());
                      }
                    }}
                  />
                  <button 
                    className="bg-blue-500 text-white px-3 py-2 rounded-md"
                    onClick={(e) => {
                      const input = e.target.previousSibling;
                      if (input.value.trim()) {
                        testUrl(input.value.trim());
                      }
                    }}
                  >
                    Test
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <p>Start the session to use this tool...</p>
        )}
      </div>
    </section>
  );
} 