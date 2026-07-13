function columnNames(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = columnNames(db, tableName);
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function applySchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#facc15',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      model_provider TEXT,
      model_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      layer TEXT NOT NULL CHECK (layer IN ('turn', 'session', 'persona')),
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      canonical_key TEXT NOT NULL UNIQUE,
      importance REAL NOT NULL DEFAULT 0.5,
      confidence REAL NOT NULL DEFAULT 0.6,
      activation REAL NOT NULL DEFAULT 0.1,
      locked INTEGER NOT NULL DEFAULT 0,
      properties TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      layer TEXT NOT NULL CHECK (layer IN ('turn', 'session', 'persona')),
      weight REAL NOT NULL DEFAULT 0.5,
      confidence REAL NOT NULL DEFAULT 0.6,
      activation REAL NOT NULL DEFAULT 0.1,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      properties TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      UNIQUE(source_id, target_id, relation_type, layer)
    );

    CREATE TABLE IF NOT EXISTS memory_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      layer TEXT NOT NULL CHECK (layer IN ('turn', 'session', 'persona')),
      node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
      edge_id TEXT REFERENCES edges(id) ON DELETE SET NULL,
      summary TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ontology_classes (
      iri TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      parent_iri TEXT,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ontology_properties (
      iri TEXT PRIMARY KEY,
      relation_type TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      domain_iri TEXT NOT NULL,
      range_iri TEXT NOT NULL,
      max_cardinality INTEGER,
      inverse_iri TEXT,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ontology_node_types (
      node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
      persona_id TEXT NOT NULL,
      class_iri TEXT NOT NULL REFERENCES ontology_classes(iri),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ontology_assertions (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      subject_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      predicate_iri TEXT NOT NULL REFERENCES ontology_properties(iri),
      object_node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      object_literal TEXT,
      status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'replaced', 'historical')),
      confidence REAL NOT NULL DEFAULT 0.6,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      evidence_message_id TEXT,
      edge_id TEXT REFERENCES edges(id) ON DELETE CASCADE,
      validation_state TEXT NOT NULL DEFAULT 'valid',
      validation_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rdf_triples (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      graph_iri TEXT NOT NULL,
      subject_iri TEXT NOT NULL,
      predicate_iri TEXT NOT NULL,
      object_kind TEXT NOT NULL CHECK (object_kind IN ('iri', 'literal')),
      object_iri TEXT,
      object_literal TEXT,
      datatype_iri TEXT,
      language TEXT,
      status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('schema', 'current', 'replaced', 'historical')),
      inferred INTEGER NOT NULL DEFAULT 0,
      source_assertion_id TEXT,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  addColumnIfMissing(db, "sessions", "persona_id", "TEXT");
  addColumnIfMissing(db, "sessions", "compressed_summary", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "sessions", "working_memory", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "sessions", "summary_updated_at", "TEXT");
  addColumnIfMissing(db, "personas", "template_key", "TEXT");
  addColumnIfMissing(db, "personas", "avatar", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "personas", "character_profile", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, "messages", "persona_id", "TEXT");
  addColumnIfMissing(db, "nodes", "persona_id", "TEXT");
  addColumnIfMissing(db, "edges", "persona_id", "TEXT");
  addColumnIfMissing(db, "memory_events", "persona_id", "TEXT");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_persona_updated
      ON sessions(persona_id, updated_at);

    CREATE INDEX IF NOT EXISTS idx_messages_session_created
      ON messages(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_messages_persona_created
      ON messages(persona_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_nodes_persona_layer_type
      ON nodes(persona_id, layer, type);

    CREATE INDEX IF NOT EXISTS idx_edges_persona_source
      ON edges(persona_id, source_id, relation_type);

    CREATE INDEX IF NOT EXISTS idx_events_persona_session_created
      ON memory_events(persona_id, session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_ontology_node_types_persona
      ON ontology_node_types(persona_id, class_iri);

    CREATE INDEX IF NOT EXISTS idx_ontology_assertions_subject
      ON ontology_assertions(persona_id, subject_node_id, predicate_iri, status);

    CREATE INDEX IF NOT EXISTS idx_ontology_assertions_object
      ON ontology_assertions(persona_id, object_node_id, predicate_iri, status);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_assertions_unique
      ON ontology_assertions(persona_id, subject_node_id, predicate_iri, COALESCE(object_node_id, ''), COALESCE(object_literal, ''));

    CREATE INDEX IF NOT EXISTS idx_rdf_triples_persona_spo
      ON rdf_triples(persona_id, subject_iri, predicate_iri);

    CREATE INDEX IF NOT EXISTS idx_rdf_triples_persona_object
      ON rdf_triples(persona_id, object_iri, predicate_iri);

    CREATE INDEX IF NOT EXISTS idx_rdf_triples_graph
      ON rdf_triples(graph_iri, predicate_iri);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_rdf_triples_unique
      ON rdf_triples(
        persona_id,
        graph_iri,
        subject_iri,
        predicate_iri,
        object_kind,
        COALESCE(object_iri, ''),
        COALESCE(object_literal, ''),
        COALESCE(datatype_iri, ''),
        COALESCE(language, '')
      );
  `);
}
