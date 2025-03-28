import { useEffect, useState } from "react";

const functionDescription = `
Call this function when a user asks for a color palette.
`;

// Comment out sessionUpdate since it's now handled in App.jsx
// const sessionUpdate = {
//   type: "session.update",
//   session: {
//     tools: [
//       {
//         type: "function",
//         name: "display_color_palette",
//         description: functionDescription,
//         parameters: {
//           type: "object",
//           strict: true,
//           properties: {
//             theme: {
//               type: "string",
//               description: "Description of the theme for the color scheme.",
//             },
//             colors: {
//               type: "array",
//               description: "Array of five hex color codes based on the theme.",
//               items: {
//                 type: "string",
//                 description: "Hex color code",
//               },
//             },
//           },
//           required: ["theme", "colors"],
//         },
//       },
//     ],
//     tool_choice: "auto",
//   },
// };

function FunctionCallOutput({ functionCallOutput }) {
  let theme = "Unknown Theme";
  let colors = [];
  let parseError = null;
  let rawArguments = "";

  try {
    // First attempt to parse the arguments as JSON
    rawArguments = functionCallOutput.arguments || '{}';
    let parsedArgs;
    
    try {
      parsedArgs = JSON.parse(rawArguments);
    } catch (e) {
      // If it's a string with quotes, try to remove the quotes and parse again
      if (rawArguments.startsWith('"') && rawArguments.endsWith('"')) {
        try {
          const stringContent = JSON.parse(rawArguments); // This extracts the string content
          if (typeof stringContent === 'string') {
            // Try to extract a theme and colors from the string content
            theme = stringContent;
            // Look for color codes in the string
            const hexMatches = stringContent.match(/#[0-9A-Fa-f]{6}/g);
            if (hexMatches && hexMatches.length > 0) {
              colors = hexMatches;
            }
          }
        } catch (innerError) {
          console.error("Error parsing quoted string:", innerError);
          parseError = "Format d'arguments incorrecte.";
        }
      } else {
        console.error("Error parsing function arguments:", e);
        parseError = "Erreur d'analyse des arguments.";
      }
    }

    // If we successfully parsed the JSON
    if (parsedArgs) {
      theme = parsedArgs.theme || theme;
      
      // If colors are provided as an array
      if (Array.isArray(parsedArgs.colors)) {
        colors = parsedArgs.colors;
      } 
      // If colors might be embedded in the theme string
      else if (typeof parsedArgs.theme === 'string' && !Array.isArray(parsedArgs.colors)) {
        // Look for hex codes in the theme string as fallback
        const hexMatches = parsedArgs.theme.match(/#[0-9A-Fa-f]{6}/g);
        if (hexMatches && hexMatches.length > 0) {
          colors = hexMatches;
        }
      }
    }
  } catch (e) {
    console.error("Error in FunctionCallOutput component:", e);
    parseError = "Erreur lors du traitement des arguments.";
  }

  // Only render color boxes if colors array is not empty
  const colorBoxes = colors.length > 0 ? (
    colors.map((color, index) => (
      <div
        key={`${color}-${index}`}
        className="w-full h-16 rounded-md flex items-center justify-center border border-gray-200"
        style={{ backgroundColor: color }}
      >
        <p className="text-sm font-bold text-black bg-slate-100 rounded-md p-2 border border-black">
          {color}
        </p>
      </div>
    ))
  ) : (
    <div>
      <p className="text-sm text-gray-500 mb-2">Pas de couleurs fournies.</p>
      <p className="text-xs text-red-500">
        L'assistant doit fournir un tableau de codes couleur hexadécimaux.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <p>Thème: {theme}</p>
      {parseError ? (
        <p className="text-red-500">{parseError}</p>
      ) : (
        colorBoxes
      )}
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto max-h-60 overflow-y-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  // Remove functionAdded state since registration is handled in App.jsx
  // const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [instructionsSent, setInstructionsSent] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("");
  const [processedCallIds, setProcessedCallIds] = useState(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Check the most recent events for the color palette tool call
    for (let i = 0; i < Math.min(events.length, 10); i++) {
      const event = events[i];
      
      // Check for color palette in response.done events
      if (event.type === "response.done" && event.response?.output) {
        event.response.output.forEach((output) => {
          // Get a unique identifier for this function call
          const callId = output.call_id || output.id || JSON.stringify(output);
          
          // Only process if we haven't processed this exact call before
          if (
            output.type === "function_call" &&
            output.name === "display_color_palette" &&
            !processedCallIds.has(callId)
          ) {
            try {
              // Extract the theme from the arguments
              const args = JSON.parse(output.arguments || '{}');
              const newTheme = args.theme || "";
              
              // If this is a new theme or we don't have a theme yet, update the display
              if (newTheme !== currentTheme || !functionCallOutput) {
                setFunctionCallOutput(output);
                setCurrentTheme(newTheme);
                setInstructionsSent(false); // Reset for new color palette
                
                // Add this call to processed set
                setProcessedCallIds(prev => new Set(prev).add(callId));
                
                setTimeout(() => {
                  sendClientEvent({
                    type: "response.create",
                    response: {
                      instructions: `
                      demandez des commentaires sur la palette de couleurs - ne répétez pas 
                      les couleurs, demandez simplement s'ils aiment les couleurs.
                    `,
                    },
                  });
                  setInstructionsSent(true);
                }, 500);
              }
            } catch (e) {
              console.error("Error processing color palette arguments:", e);
            }
          }
        });
      }
      
      // Check for color palette in response.update events (tool_calls format)
      if (event.type === "response.update" && event.response?.content) {
        const content = event.response.content;
        if (Array.isArray(content)) {
          const toolCalls = content.filter(item => item.type === "tool_calls");
          
          for (const toolCall of toolCalls) {
            if (!toolCall.tool_calls) continue;
            
            for (const call of toolCall.tool_calls) {
              // Get a unique identifier for this call
              const callId = call.id || JSON.stringify(call);
              
              if (call.function?.name === "display_color_palette" && !processedCallIds.has(callId)) {
                try {
                  // Extract the theme
                  const args = JSON.parse(call.function.arguments);
                  const newTheme = args.theme || "";
                  
                  // If this is a new theme or we don't have a theme yet, update the display
                  if (newTheme !== currentTheme || !functionCallOutput) {
                    const output = {
                      type: "function_call",
                      name: "display_color_palette",
                      arguments: JSON.stringify(args)
                    };
                    setFunctionCallOutput(output);
                    setCurrentTheme(newTheme);
                    setInstructionsSent(false); // Reset for new color palette
                    
                    // Add this call to processed set
                    setProcessedCallIds(prev => new Set(prev).add(callId));
                    
                    setTimeout(() => {
                      sendClientEvent({
                        type: "response.create",
                        response: {
                          instructions: `
                          demandez des commentaires sur la palette de couleurs - ne répétez pas 
                          les couleurs, demandez simplement s'ils aiment les couleurs.
                        `,
                        },
                      });
                      setInstructionsSent(true);
                    }, 500);
                  }
                } catch (e) {
                  console.error("Error parsing tool call arguments:", e);
                }
              }
            }
          }
        }
      }
    }
  }, [events, sendClientEvent, currentTheme, processedCallIds]);

  useEffect(() => {
    if (!isSessionActive) {
      // setFunctionAdded(false);
      setFunctionCallOutput(null);
      setInstructionsSent(false);
      setCurrentTheme("");
      setProcessedCallIds(new Set());
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Palette de Couleurs</h2>
        {isSessionActive ? (
          functionCallOutput ? (
            <FunctionCallOutput functionCallOutput={functionCallOutput} />
          ) : (
            <p>Demandez des conseils sur une palette de couleurs...</p>
          )
        ) : (
          <p>Démarrez la session pour utiliser cet outil...</p>
        )}
      </div>
    </section>
  );
}
