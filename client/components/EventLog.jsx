import { ArrowUp, ArrowDown } from "react-feather";
import { useState, useEffect } from "react";

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
  const [activeTranscriptions, setActiveTranscriptions] = useState({});
  
  // Log when we receive new events
  useEffect(() => {
    if (events.length > 0) {
     // console.log(`Received ${events.length} total events`);
      
      // Count events by type for overview
      const eventTypes = {};
      events.forEach(e => {
        eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
      });
      //console.log("Event types:", eventTypes);
    }
  }, [events]);
  
  useEffect(() => {
    // Get only response.audio_transcript.done events
    const transcriptEvents = events.filter(event => 
      event.type === "response.audio_transcript.done" && event.transcript
    );
    
    if (transcriptEvents.length === 0) return;
    
    // Process each transcript event
    const updates = {};
    transcriptEvents.forEach(event => {
      const key = event.response_id + "-" + event.item_id;
      
      if (event.transcript && typeof event.transcript === 'string' && event.transcript.trim().length > 0) {
        updates[key] = {
          content: event.transcript.trim(),
          timestamp: event.timestamp,
          key: key,
          item_id: event.item_id
        };
      }
    });
    
    if (Object.keys(updates).length > 0) {
      //console.log(`Adding ${Object.keys(updates).length} transcriptions:`, updates);
      setActiveTranscriptions(prev => ({ ...prev, ...updates }));
    }
  }, [events]);

  // Convert the transcriptions object to an array for rendering
  const transcriptionsToDisplay = Object.values(activeTranscriptions)
    .filter(item => item.content && item.content.trim().length > 0)
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    })
    .map(item => (
      <TranscriptionEvent 
        key={item.key}
        content={item.content}
        timestamp={item.timestamp}
      />
    ));
    
  // Log when transcriptions change
  useEffect(() => {
    console.log(`Displaying ${transcriptionsToDisplay.length} transcriptions`);
  }, [transcriptionsToDisplay.length]);

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      {transcriptionsToDisplay.length === 0 ? (
        <div className="text-gray-500">En attente de la prise de parole de l'élève avec le tuteur de français...</div>
      ) : (
        transcriptionsToDisplay
      )}
    </div>
  );
}
