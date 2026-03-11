/**
 * Generates styled HTML for a note.
 * 
 * @param {Object} params
 * @param {string} params.content - The base content (HTML partial)
 * @returns {string} Fully styled HTML string
 */
export default function generateStyledHTML({ content }) {
  return `
    <div class="notes-container" style="font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 800px; margin: 0 auto; padding: 40px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap');
        
        .notes-container {
          overflow-wrap: break-word;
        }
        
        h1 { 
          font-family: 'Outfit', sans-serif; 
          font-size: 2.5rem; 
          font-weight: 800; 
          color: #0f172a; 
          margin-top: 0; 
          margin-bottom: 1.5rem;
          line-height: 1.2;
        }
        
        h2 { 
          font-family: 'Outfit', sans-serif; 
          font-size: 1.75rem; 
          font-weight: 700; 
          color: #1e293b; 
          margin-top: 2.5rem; 
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #f1f5f9;
        }
        
        h3 { 
          font-family: 'Outfit', sans-serif; 
          font-size: 1.25rem; 
          font-weight: 600; 
          color: #334155; 
          margin-top: 2rem; 
          margin-bottom: 0.75rem;
        }
        
        p { margin-bottom: 1.25rem; font-size: 1rem; }
        
        ul, ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
        
        li { margin-bottom: 0.75rem; }
        
        strong { color: #0f172a; font-weight: 600; }
        
        .summary-box {
          background: #f8fafc;
          border-left: 4px solid #6366f1;
          padding: 1.5rem;
          border-radius: 0 1rem 1rem 0;
          margin: 2.5rem 0;
        }
        
        .summary-box h2 {
          margin-top: 0;
          border-bottom: none;
          color: #6366f1;
          font-size: 1.25rem;
        }

        .definition-box {
          background: #f1f5f9;
          border-radius: 1rem;
          padding: 1.25rem;
          margin: 1.5rem 0;
          font-style: italic;
        }
      </style>
      
      <div class="note-body">
        ${content}
      </div>
    </div>
  `;
}
