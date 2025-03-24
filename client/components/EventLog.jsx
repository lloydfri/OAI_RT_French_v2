import { ArrowUp, ArrowDown } from "react-feather";
import { useState } from "react";

function TranscriptionEvent({ content, timestamp }) {
  return (
    <div className="flex flex-col gap-2 p-2 rounded-md bg-gray-100 border-l-4 border-green-500">
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-500">
          Tuteur Français | {timestamp}
        </div>
      </div>
      <div className="text-gray-800 p-2 rounded-md">
        {content}
      </div>
    </div>
  );
}

export default function EventLog({ events }) {
  // Extract only transcriptions from the server
  const transcriptionsToDisplay = events
    .filter(event => {
      // Only include response.done events with completed status that have output
      return (
        event.type === "response.done" && 
        event.event_id && 
        event.event_id.startsWith("event_") &&
        event.response?.status === "completed" &&
        Array.isArray(event.response?.output)
      );
    })
    .map(event => {
      // Find the text content in the output array
      let content = "";
      
      if (event.response.output) {
        for (const item of event.response.output) {
          // Check for message items that contain audio content with transcripts
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const contentItem of item.content) {
              // For audio items, get the transcript property
              if (contentItem.type === "audio" && contentItem.transcript) {
                content = contentItem.transcript;
                break;
              }
              // Also check for text content (fallback)
              else if (contentItem.type === "text" && contentItem.text) {
                content = contentItem.text;
                break;
              }
            }
          }
          // Direct text in the output item (fallback)
          else if (item.type === "text" && item.text) {
            content = item.text;
          }
          
          if (content) break;
        }
      }
      
      return {
        key: event.event_id,
        content: content,
        timestamp: event.timestamp,
      };
    })
    .filter(item => item.content) // Only include items with actual content
    .map(item => (
      <TranscriptionEvent 
        key={item.key} 
        content={item.content} 
        timestamp={item.timestamp} 
      />
    ));

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      {transcriptionsToDisplay.length === 0 ? (
        <div className="text-gray-500">En attente de la prise de parole de l’élève avec le tuteur de français...</div>
      ) : (
        transcriptionsToDisplay
      )}
    </div>
  );
}
