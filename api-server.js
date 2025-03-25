const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.API_PORT || 3000;

// Import neo4j driver directly
const neo4j = require('neo4j-driver');

// Neo4j connection configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://neo4j:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const MAX_RETRY_ATTEMPTS = 20;
const RETRY_INTERVAL = 3000; // 3 seconds

// Create the Neo4j driver instance
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { maxConnectionLifetime: 3 * 60 * 60 * 1000 } // 3 hours
);

// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Helper function to close the driver
function closeDriver() {
  driver.close();
}

// Connect to Neo4j with retry
async function connectWithRetry(attempt = 1) {
  try {
    await driver.verifyConnectivity();
    console.log('Successfully connected to Neo4j database');
    return true;
  } catch (error) {
    console.error(`Connection attempt ${attempt} failed:`, error.message);
    
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.log(`Retrying in ${RETRY_INTERVAL/1000} seconds...`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(connectWithRetry(attempt + 1));
        }, RETRY_INTERVAL);
      });
    } else {
      console.error(`Failed to connect to Neo4j after ${MAX_RETRY_ATTEMPTS} attempts`);
      return false;
    }
  }
}

// Verify connectivity on startup
let isConnected = false;
connectWithRetry().then(connected => {
  isConnected = connected;
  if (isConnected) {
    console.log('API is ready to handle requests');
  } else {
    console.error('Warning: API starting without Neo4j connection');
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connected = await driver.verifyConnectivity();
    res.json({ 
      status: 'ok',
      neo4j: 'connected'
    });
  } catch (error) {
    res.json({ 
      status: 'database_error',
      neo4j: 'disconnected',
      error: error.message
    });
  }
});

// Get all notes
app.get('/api/notes', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Note)
      OPTIONAL MATCH (n)-[:REFERS_TO]->(v:Verse)
      RETURN n, v
    `);
    
    const notes = result.records.map(record => {
      const note = record.get('n').properties;
      const verse = record.get('v') ? record.get('v').properties : null;
      
      // Handle tags (stored as a string array or comma-delimited string)
      if (typeof note.tags === 'string') {
        note.tags = note.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
      
      return {
        ...note,
        verse: verse
      };
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  } finally {
    await session.close();
  }
});

// Get a specific note by ID
app.get('/api/notes/:id', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Note {id: $id})
      OPTIONAL MATCH (n)-[:REFERS_TO]->(v:Verse)
      RETURN n, v
    `, { id: req.params.id });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const record = result.records[0];
    const note = record.get('n').properties;
    const verse = record.get('v') ? record.get('v').properties : null;
    
    // Handle tags (stored as a string array or comma-delimited string)
    if (typeof note.tags === 'string') {
      note.tags = note.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    res.json({
      ...note,
      verse: verse
    });
  } catch (error) {
    console.error(`Error fetching note ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch note' });
  } finally {
    await session.close();
  }
});

// Get a verse by ID
app.get('/api/verses/:id', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (v:Verse {id: $id})
      RETURN v
    `, { id: req.params.id });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Verse not found' });
    }
    
    const verse = result.records[0].get('v').properties;
    res.json(verse);
  } catch (error) {
    console.error(`Error fetching verse ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch verse' });
  } finally {
    await session.close();
  }
});

// Get a verse by reference
app.get('/api/verses/reference/:book/:chapter/:verse', async (req, res) => {
  const session = driver.session();
  try {
    const { book, chapter, verse } = req.params;
    const result = await session.run(`
      MATCH (v:Verse {book: $book, chapter: toInteger($chapter), verse: toInteger($verse)})
      RETURN v
    `, { 
      book, 
      chapter: parseInt(chapter), 
      verse: parseInt(verse) 
    });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Verse not found' });
    }
    
    const verseData = result.records[0].get('v').properties;
    res.json(verseData);
  } catch (error) {
    console.error(`Error fetching verse by reference:`, error);
    res.status(500).json({ error: 'Failed to fetch verse by reference' });
  } finally {
    await session.close();
  }
});

// Get all tags
app.get('/api/tags', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Note)
      WHERE n.tags IS NOT NULL
      RETURN n.tags
    `);
    
    // Extract all tags from notes
    let allTags = [];
    result.records.forEach(record => {
      const tags = record.get('n.tags');
      if (Array.isArray(tags)) {
        allTags = allTags.concat(tags);
      } else if (typeof tags === 'string') {
        allTags = allTags.concat(tags.split(',').map(tag => tag.trim()).filter(tag => tag));
      }
    });
    
    // Get unique tags
    const uniqueTags = [...new Set(allTags)];
    res.json(uniqueTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  } finally {
    await session.close();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDriver();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDriver();
  process.exit(0);
});

// Start the server
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`Connecting to Neo4j at ${NEO4J_URI}`);
}); 