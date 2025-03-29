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

// Create the Neo4j driver instance with improved configuration
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { 
    maxTransactionRetryTime: 30000, // 30 seconds max retry time
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    logging: {
      level: 'info',
      logger: (level, message) => console.log(`[neo4j ${level}] ${message}`)
    }
  }
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
    console.debug('Successfully connected to Neo4j database');
    return true;
  } catch (error) {
    console.error(`Connection attempt ${attempt} failed:`, error.message);
    
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.debug(`Retrying in ${RETRY_INTERVAL/1000} seconds...`);
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
    console.debug('API is ready to handle requests');
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
      neo4j: 'connected',
      driver_version: neo4j.version
    });
  } catch (error) {
    res.json({ 
      status: 'database_error',
      neo4j: 'disconnected',
      error: error.message
    });
  }
});

// Get all notes - using transaction function
app.get('/api/notes', async (req, res) => {
  const session = driver.session();
  try {
    const notes = await session.executeRead(async tx => {
      const result = await tx.run(`
        MATCH (n:Note)
        OPTIONAL MATCH (n)-[:REFERS_TO]->(v:Verse)
        RETURN n, v
      `);
      
      return result.records.map(record => {
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
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  } finally {
    await session.close();
  }
});

// Get a specific note by ID - using transaction function
app.get('/api/notes/:id', async (req, res) => {
  const session = driver.session();
  try {
    const note = await session.executeRead(async tx => {
      const result = await tx.run(`
        MATCH (n:Note {id: $id})
        OPTIONAL MATCH (n)-[:REFERS_TO]->(v:Verse)
        RETURN n, v
      `, { id: req.params.id });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const record = result.records[0];
      const noteProps = record.get('n').properties;
      const verse = record.get('v') ? record.get('v').properties : null;
      
      // Handle tags (stored as a string array or comma-delimited string)
      if (typeof noteProps.tags === 'string') {
        noteProps.tags = noteProps.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
      
      return {
        ...noteProps,
        verse: verse
      };
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    console.error(`Error fetching note ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch note' });
  } finally {
    await session.close();
  }
});

// Get a verse by ID - using transaction function
app.get('/api/verses/:id', async (req, res) => {
  const session = driver.session();
  try {
    const verse = await session.executeRead(async tx => {
      const result = await tx.run(`
        MATCH (v:Verse {id: $id})
        RETURN v
      `, { id: req.params.id });
      
      if (result.records.length === 0) {
        return null;
      }
      
      return result.records[0].get('v').properties;
    });
    
    if (!verse) {
      return res.status(404).json({ error: 'Verse not found' });
    }
    
    res.json(verse);
  } catch (error) {
    console.error(`Error fetching verse ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch verse' });
  } finally {
    await session.close();
  }
});

// Get a verse by reference - using transaction function
app.get('/api/verses/reference/:book/:chapter/:verse', async (req, res) => {
  const session = driver.session();
  try {
    const { book, chapter, verse } = req.params;
    
    const verseData = await session.executeRead(async tx => {
      const result = await tx.run(`
        MATCH (v:Verse {book: $book, chapter: toInteger($chapter), verse: toInteger($verse)})
        RETURN v
      `, { 
        book, 
        chapter: parseInt(chapter), 
        verse: parseInt(verse) 
      });
      
      if (result.records.length === 0) {
        return null;
      }
      
      return result.records[0].get('v').properties;
    });
    
    if (!verseData) {
      return res.status(404).json({ error: 'Verse not found' });
    }
    
    res.json(verseData);
  } catch (error) {
    console.error(`Error fetching verse by reference:`, error);
    res.status(500).json({ error: 'Failed to fetch verse by reference' });
  } finally {
    await session.close();
  }
});

// Get all tags - using transaction function
app.get('/api/tags', async (req, res) => {
  const session = driver.session();
  try {
    const tags = await session.executeRead(async tx => {
      const result = await tx.run(`
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
      return [...new Set(allTags)];
    });
    
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  } finally {
    await session.close();
  }
});

// Add endpoint for creating notes
app.post('/api/notes', async (req, res) => {
  const { text, tags, verseId } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Note text is required' });
  }
  
  const session = driver.session();
  try {
    const result = await session.executeWrite(async tx => {
      // Generate a unique ID for the note
      const query = verseId 
        ? `
          MATCH (v:Verse {id: $verseId})
          CREATE (n:Note {id: randomUUID(), text: $text, tags: $tags, created: datetime()})
          CREATE (n)-[:REFERS_TO]->(v)
          RETURN n, v
        `
        : `
          CREATE (n:Note {id: randomUUID(), text: $text, tags: $tags, created: datetime()})
          RETURN n, null as v
        `;
      
      const result = await tx.run(query, { 
        text, 
        tags: Array.isArray(tags) ? tags : [], 
        verseId 
      });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const record = result.records[0];
      const note = record.get('n').properties;
      const verse = record.get('v') ? record.get('v').properties : null;
      
      return {
        ...note,
        verse
      };
    });
    
    if (!result) {
      return res.status(500).json({ error: 'Failed to create note' });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
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
  console.debug(`API Server running on port ${PORT}`);
  console.debug(`Connecting to Neo4j at ${NEO4J_URI}`);
}); 