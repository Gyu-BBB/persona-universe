import crypto from "node:crypto";
import {
  ONTOLOGY_CLASSES,
  ONTOLOGY_PROPERTIES,
  OWL,
  RDF,
  RDFS,
  XSD,
  classForNodeType,
  compactIri,
  expandIri,
  isClassCompatible,
  nodeIri,
  personaGraphIri,
  propertyForRelation,
  schemaGraphIri,
  schemaIri
} from "./ontologySchema.js";

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function stringify(value) {
  return JSON.stringify(value ?? {});
}

const DEFAULT_PERSONA = {
  templateKey: "serin",
  avatar: "서",
  name: "서린",
  description: "밤 산책처럼 차분하게 곁을 지키며 사용자의 마음과 맥락을 오래 기억하는 대화 상대",
  systemPrompt: "서린은 조용하고 다정한 동행자다. 사용자의 감정과 관계 맥락을 먼저 살피고, 과장 없이 짧고 따뜻하게 답한다.",
  color: "#5eead4"
};

const PERSONA_TEMPLATES = [
  DEFAULT_PERSONA,
  {
    templateKey: "haon",
    avatar: "하",
    name: "하온",
    description: "가까운 친구처럼 편하게 받아주고 일상의 기분 변화를 섬세하게 기억하는 캐릭터",
    systemPrompt: "하온은 밝고 친근한 친구 같은 페르소나다. 사용자의 말을 쉽게 받아주고, 부담을 낮추는 말투로 자연스럽게 대화한다.",
    color: "#facc15"
  },
  {
    templateKey: "ian",
    avatar: "이",
    name: "이안",
    description: "문제를 구조화하고 선택지를 날카롭게 정리하는 전략형 조언자",
    systemPrompt: "이안은 침착한 전략가다. 사용자의 목표, 제약, 이전 결정을 기억하고 현실적인 다음 행동으로 정리해 답한다.",
    color: "#60a5fa"
  },
  {
    templateKey: "miro",
    avatar: "미",
    name: "미로",
    description: "아이디어를 넓게 펼치고 상상력을 자극하는 창작 파트너",
    systemPrompt: "미로는 호기심 많은 창작 파트너다. 사용자의 취향과 프로젝트 맥락을 기억해 새로운 관점과 구체적인 아이디어를 제안한다.",
    color: "#c084fc"
  },
  {
    templateKey: "noa",
    avatar: "노",
    name: "노아",
    description: "흔들릴 때 기준을 잡아주고 실행 루틴을 만드는 단단한 코치",
    systemPrompt: "노아는 담백하고 단단한 코치다. 사용자의 상태를 인정하되 늘 작게 실행할 수 있는 다음 단계로 연결한다.",
    color: "#fb7185"
  }
];

export class OntologyStore {
  constructor(db) {
    this.db = db;
    this.ensureTemplatePersonas();
    this.defaultPersona = this.ensureDefaultPersona();
    this.migrateExistingRows(this.defaultPersona.id);
    this.ensureOntologySchema();
    this.statements = this.prepareStatements();
    this.materializeRdfVocabulary();
    this.materializeExistingOntology();
  }

  prepareStatements() {
    return {
      listPersonas: this.db.prepare("SELECT * FROM personas WHERE active = 1 ORDER BY updated_at DESC, created_at DESC"),
      getPersona: this.db.prepare("SELECT * FROM personas WHERE id = ? AND active = 1"),
      getAnyPersona: this.db.prepare("SELECT * FROM personas WHERE id = ?"),
      countActivePersonas: this.db.prepare("SELECT COUNT(*) AS count FROM personas WHERE active = 1"),
      insertPersona: this.db.prepare(`
        INSERT INTO personas (id, name, description, system_prompt, color, template_key, avatar, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `),
      touchPersona: this.db.prepare("UPDATE personas SET updated_at = ? WHERE id = ?"),
      deactivatePersona: this.db.prepare("UPDATE personas SET active = 0, updated_at = ? WHERE id = ?"),

      getSession: this.db.prepare("SELECT * FROM sessions WHERE id = ?"),
      listSessions: this.db.prepare("SELECT * FROM sessions WHERE persona_id = ? ORDER BY updated_at DESC LIMIT 30"),
      insertSession: this.db.prepare("INSERT INTO sessions (id, persona_id, title, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"),
      touchSession: this.db.prepare("UPDATE sessions SET title = COALESCE(?, title), updated_at = ? WHERE id = ?"),
      updateSessionMemory: this.db.prepare(`
        UPDATE sessions
        SET compressed_summary = ?, working_memory = ?, summary_updated_at = ?, updated_at = ?
        WHERE id = ?
      `),

      insertMessage: this.db.prepare(`
        INSERT INTO messages (id, persona_id, session_id, role, content, model_provider, model_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      listMessages: this.db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"),
      listPersonaMessages: this.db.prepare(`
        SELECT messages.*, sessions.title AS session_title
        FROM messages
        JOIN sessions ON sessions.id = messages.session_id
        WHERE messages.persona_id = ?
        ORDER BY messages.created_at DESC
        LIMIT ?
      `),

      getNodeByKey: this.db.prepare("SELECT * FROM nodes WHERE canonical_key = ?"),
      getNodeById: this.db.prepare("SELECT * FROM nodes WHERE id = ?"),
      insertNode: this.db.prepare(`
        INSERT INTO nodes (id, persona_id, layer, type, label, summary, canonical_key, importance, confidence, activation, locked, properties, created_at, updated_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateNode: this.db.prepare(`
        UPDATE nodes
        SET label = ?, summary = ?, importance = ?, confidence = ?, activation = ?, properties = ?, updated_at = ?, last_seen_at = ?
        WHERE id = ?
      `),

      getEdgeByUnique: this.db.prepare(`
        SELECT * FROM edges
        WHERE persona_id = ? AND source_id = ? AND target_id = ? AND relation_type = ? AND layer = ?
      `),
      getSupersedingEdgeForNode: this.db.prepare(`
        SELECT * FROM edges
        WHERE persona_id = ? AND source_id = ? AND relation_type = 'superseded_by'
        LIMIT 1
      `),
      insertEdge: this.db.prepare(`
        INSERT INTO edges (id, persona_id, source_id, target_id, relation_type, layer, weight, confidence, activation, evidence_count, properties, created_at, updated_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateEdge: this.db.prepare(`
        UPDATE edges
        SET weight = ?, confidence = ?, activation = ?, evidence_count = ?, properties = ?, updated_at = ?, last_seen_at = ?
        WHERE id = ?
      `),

      upsertOntologyClass: this.db.prepare(`
        INSERT INTO ontology_classes (iri, label, parent_iri, description)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(iri) DO UPDATE SET
          label = excluded.label,
          parent_iri = excluded.parent_iri,
          description = excluded.description
      `),
      upsertOntologyProperty: this.db.prepare(`
        INSERT INTO ontology_properties (iri, relation_type, label, domain_iri, range_iri, max_cardinality, inverse_iri, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(iri) DO UPDATE SET
          relation_type = excluded.relation_type,
          label = excluded.label,
          domain_iri = excluded.domain_iri,
          range_iri = excluded.range_iri,
          max_cardinality = excluded.max_cardinality,
          inverse_iri = excluded.inverse_iri,
          description = excluded.description
      `),
      upsertOntologyNodeType: this.db.prepare(`
        INSERT INTO ontology_node_types (node_id, persona_id, class_iri, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
          persona_id = excluded.persona_id,
          class_iri = excluded.class_iri,
          updated_at = excluded.updated_at
      `),
      getOntologyNodeType: this.db.prepare("SELECT * FROM ontology_node_types WHERE node_id = ?"),
      getOntologyProperty: this.db.prepare("SELECT * FROM ontology_properties WHERE relation_type = ?"),
      getOntologyAssertion: this.db.prepare(`
        SELECT * FROM ontology_assertions
        WHERE persona_id = ?
          AND subject_node_id = ?
          AND predicate_iri = ?
          AND COALESCE(object_node_id, '') = COALESCE(?, '')
          AND COALESCE(object_literal, '') = COALESCE(?, '')
      `),
      insertOntologyAssertion: this.db.prepare(`
        INSERT INTO ontology_assertions (
          id, persona_id, subject_node_id, predicate_iri, object_node_id, object_literal,
          status, confidence, evidence_count, evidence_message_id, edge_id,
          validation_state, validation_note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateOntologyAssertion: this.db.prepare(`
        UPDATE ontology_assertions
        SET status = ?, confidence = ?, evidence_count = evidence_count + 1,
          evidence_message_id = COALESCE(?, evidence_message_id),
          edge_id = COALESCE(?, edge_id),
          validation_state = ?, validation_note = ?, updated_at = ?
        WHERE id = ?
      `),
      listCurrentAssertionsForObject: this.db.prepare(`
        SELECT assertion.*, property.max_cardinality
        FROM ontology_assertions assertion
        JOIN ontology_properties property ON property.iri = assertion.predicate_iri
        WHERE assertion.persona_id = ?
          AND assertion.object_node_id = ?
          AND assertion.status = 'current'
      `),
      listCurrentAssertionsTouchingNode: this.db.prepare(`
        SELECT assertion.*, property.relation_type, property.max_cardinality
        FROM ontology_assertions assertion
        JOIN ontology_properties property ON property.iri = assertion.predicate_iri
        WHERE assertion.persona_id = ?
          AND assertion.status = 'current'
          AND (assertion.subject_node_id = ? OR assertion.object_node_id = ?)
      `),
      listCurrentAssertionsForSubjectPredicate: this.db.prepare(`
        SELECT assertion.*, property.relation_type, property.max_cardinality
        FROM ontology_assertions assertion
        JOIN ontology_properties property ON property.iri = assertion.predicate_iri
        WHERE assertion.persona_id = ?
          AND assertion.subject_node_id = ?
          AND assertion.predicate_iri = ?
          AND assertion.status = 'current'
      `),
      markOntologyAssertionStatus: this.db.prepare(`
        UPDATE ontology_assertions
        SET status = ?, updated_at = ?
        WHERE id = ?
      `),
      listOntologyAssertions: this.db.prepare(`
        SELECT assertion.*, property.relation_type, property.label AS predicate_label
        FROM ontology_assertions assertion
        JOIN ontology_properties property ON property.iri = assertion.predicate_iri
        WHERE assertion.persona_id = ?
        ORDER BY assertion.updated_at DESC
        LIMIT ?
      `),
      getRdfTriple: this.db.prepare(`
        SELECT * FROM rdf_triples
        WHERE persona_id = ?
          AND graph_iri = ?
          AND subject_iri = ?
          AND predicate_iri = ?
          AND object_kind = ?
          AND COALESCE(object_iri, '') = COALESCE(?, '')
          AND COALESCE(object_literal, '') = COALESCE(?, '')
          AND COALESCE(datatype_iri, '') = COALESCE(?, '')
          AND COALESCE(language, '') = COALESCE(?, '')
      `),
      insertRdfTriple: this.db.prepare(`
        INSERT OR IGNORE INTO rdf_triples (
          id, persona_id, graph_iri, subject_iri, predicate_iri, object_kind,
          object_iri, object_literal, datatype_iri, language, status, inferred,
          source_assertion_id, reason, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateRdfTriple: this.db.prepare(`
        UPDATE rdf_triples
        SET status = ?, inferred = ?, source_assertion_id = COALESCE(?, source_assertion_id),
          reason = ?, updated_at = ?
        WHERE id = ?
      `),
      updateRdfTriplesByAssertion: this.db.prepare(`
        UPDATE rdf_triples
        SET status = ?, updated_at = ?
        WHERE persona_id = ? AND source_assertion_id = ?
      `),
      deleteInferredRdfTriples: this.db.prepare(`
        DELETE FROM rdf_triples
        WHERE persona_id = ? AND inferred = 1
      `),
      deleteRdfTriplesForPersona: this.db.prepare("DELETE FROM rdf_triples WHERE persona_id = ?"),
      listRdfTriples: this.db.prepare(`
        SELECT * FROM rdf_triples
        WHERE persona_id IN ('__schema__', ?)
        ORDER BY graph_iri, subject_iri, predicate_iri
        LIMIT ?
      `),

      insertEvent: this.db.prepare(`
        INSERT INTO memory_events (id, persona_id, session_id, message_id, event_type, layer, node_id, edge_id, summary, before_state, after_state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      listNodes: this.db.prepare(`
        SELECT * FROM nodes
        WHERE persona_id = ?
        ORDER BY activation DESC, importance DESC, updated_at DESC
        LIMIT 500
      `),
      listEdges: this.db.prepare(`
        SELECT * FROM edges
        WHERE persona_id = ?
        ORDER BY activation DESC, weight DESC, updated_at DESC
        LIMIT 900
      `),
      recentEvents: this.db.prepare(`
        SELECT * FROM memory_events
        WHERE persona_id = ? AND session_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `),
      topNodesByLayer: this.db.prepare(`
        SELECT * FROM nodes
        WHERE persona_id = ? AND layer = ?
        ORDER BY activation DESC, importance DESC, updated_at DESC
        LIMIT ?
      `),
      resetEdges: this.db.prepare("DELETE FROM edges WHERE persona_id = ?"),
      resetNodes: this.db.prepare("DELETE FROM nodes WHERE persona_id = ?"),
      resetEvents: this.db.prepare("DELETE FROM memory_events WHERE persona_id = ?"),
      resetMessages: this.db.prepare("DELETE FROM messages WHERE persona_id = ?"),
      resetSessions: this.db.prepare("DELETE FROM sessions WHERE persona_id = ?"),
      resetOntologyNodeTypes: this.db.prepare("DELETE FROM ontology_node_types WHERE persona_id = ?"),
      resetOntologyAssertions: this.db.prepare("DELETE FROM ontology_assertions WHERE persona_id = ?"),
      resetRdfTriples: this.db.prepare("DELETE FROM rdf_triples WHERE persona_id = ?")
    };
  }

  ensureOntologySchema() {
    const upsertClass = this.db.prepare(`
      INSERT INTO ontology_classes (iri, label, parent_iri, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(iri) DO UPDATE SET
        label = excluded.label,
        parent_iri = excluded.parent_iri,
        description = excluded.description
    `);
    const upsertProperty = this.db.prepare(`
      INSERT INTO ontology_properties (iri, relation_type, label, domain_iri, range_iri, max_cardinality, inverse_iri, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(iri) DO UPDATE SET
        relation_type = excluded.relation_type,
        label = excluded.label,
        domain_iri = excluded.domain_iri,
        range_iri = excluded.range_iri,
        max_cardinality = excluded.max_cardinality,
        inverse_iri = excluded.inverse_iri,
        description = excluded.description
    `);
    for (const item of ONTOLOGY_CLASSES) {
      upsertClass.run(item.iri, item.label, item.parentIri || null, item.description || "");
    }
    for (const item of ONTOLOGY_PROPERTIES) {
      upsertProperty.run(item.iri, item.relationType, item.label, item.domainIri, item.rangeIri, item.maxCardinality, item.inverseIri || null, item.description || "");
    }
  }

  materializeExistingOntology() {
    this.bulkMaterializing = true;
    const nodes = this.db.prepare("SELECT * FROM nodes WHERE persona_id IS NOT NULL").all();
    for (const node of nodes) {
      this.syncOntologyNodeType(node);
    }
    const edges = this.db.prepare("SELECT * FROM edges WHERE persona_id IS NOT NULL").all();
    for (const edge of edges) {
      this.syncOntologyEdge({ ...edge, properties: parseJson(edge.properties) }, edge.relation_type, {});
    }
    this.bulkMaterializing = false;
    const personaIds = this.db.prepare("SELECT DISTINCT persona_id FROM nodes WHERE persona_id IS NOT NULL").all().map((row) => row.persona_id);
    for (const personaId of personaIds) {
      this.runReasoner(personaId);
    }
  }

  upsertRdfTriple({
    personaId = "__schema__",
    graphIri = schemaGraphIri(),
    subjectIri,
    predicateIri,
    objectIri = null,
    objectLiteral = null,
    datatypeIri = null,
    language = null,
    status = "current",
    inferred = false,
    sourceAssertionId = null,
    reason = ""
  }) {
    const objectKind = objectIri ? "iri" : "literal";
    const timestamp = nowIso();
    const existing = this.statements.getRdfTriple.get(
      personaId,
      graphIri,
      subjectIri,
      predicateIri,
      objectKind,
      objectIri,
      objectLiteral,
      datatypeIri,
      language
    );
    if (existing) {
      const nextInferred = existing.inferred === 0 && inferred ? 0 : inferred ? 1 : 0;
      this.statements.updateRdfTriple.run(
        status,
        nextInferred,
        sourceAssertionId,
        existing.inferred === 0 && inferred ? existing.reason : reason,
        timestamp,
        existing.id
      );
      return {
        ...existing,
        status,
        inferred: nextInferred,
        source_assertion_id: sourceAssertionId || existing.source_assertion_id,
        reason: existing.inferred === 0 && inferred ? existing.reason : reason,
        updated_at: timestamp
      };
    }
    const triple = {
      id: crypto.randomUUID(),
      persona_id: personaId,
      graph_iri: graphIri,
      subject_iri: subjectIri,
      predicate_iri: predicateIri,
      object_kind: objectKind,
      object_iri: objectIri,
      object_literal: objectLiteral,
      datatype_iri: datatypeIri,
      language,
      status,
      inferred: inferred ? 1 : 0,
      source_assertion_id: sourceAssertionId,
      reason,
      created_at: timestamp,
      updated_at: timestamp
    };
    const result = this.statements.insertRdfTriple.run(
      triple.id,
      triple.persona_id,
      triple.graph_iri,
      triple.subject_iri,
      triple.predicate_iri,
      triple.object_kind,
      triple.object_iri,
      triple.object_literal,
      triple.datatype_iri,
      triple.language,
      triple.status,
      triple.inferred,
      triple.source_assertion_id,
      triple.reason,
      triple.created_at,
      triple.updated_at
    );
    if (result.changes === 0) {
      const concurrentExisting = this.statements.getRdfTriple.get(
        personaId,
        graphIri,
        subjectIri,
        predicateIri,
        objectKind,
        objectIri,
        objectLiteral,
        datatypeIri,
        language
      );
      if (concurrentExisting) {
        const nextInferred = concurrentExisting.inferred === 0 && inferred ? 0 : inferred ? 1 : 0;
        this.statements.updateRdfTriple.run(
          status,
          nextInferred,
          sourceAssertionId,
          concurrentExisting.inferred === 0 && inferred ? concurrentExisting.reason : reason,
          timestamp,
          concurrentExisting.id
        );
        return {
          ...concurrentExisting,
          status,
          inferred: nextInferred,
          source_assertion_id: sourceAssertionId || concurrentExisting.source_assertion_id,
          reason: concurrentExisting.inferred === 0 && inferred ? concurrentExisting.reason : reason,
          updated_at: timestamp
        };
      }
    }
    return triple;
  }

  materializeRdfVocabulary() {
    this.db.prepare("DELETE FROM rdf_triples WHERE persona_id = '__schema__'").run();
    const graphIri = schemaGraphIri();
    const addIri = (subjectIri, predicateIri, objectIri, reason = "ontology schema") => this.upsertRdfTriple({
      personaId: "__schema__",
      graphIri,
      subjectIri,
      predicateIri,
      objectIri,
      status: "schema",
      reason
    });
    const addLiteral = (subjectIri, predicateIri, objectLiteral, reason = "ontology schema") => this.upsertRdfTriple({
      personaId: "__schema__",
      graphIri,
      subjectIri,
      predicateIri,
      objectLiteral,
      datatypeIri: XSD.string,
      status: "schema",
      reason
    });

    addIri(graphIri, RDF.type, OWL.ontology);
    for (const ontologyClass of ONTOLOGY_CLASSES) {
      const classIri = schemaIri(ontologyClass.iri);
      addIri(classIri, RDF.type, OWL.class);
      addLiteral(classIri, RDFS.label, ontologyClass.label);
      if (ontologyClass.description) addLiteral(classIri, RDFS.comment, ontologyClass.description);
      if (ontologyClass.parentIri) addIri(classIri, RDFS.subClassOf, schemaIri(ontologyClass.parentIri));
    }
    for (const property of ONTOLOGY_PROPERTIES) {
      const propertyIri = schemaIri(property.iri);
      addIri(propertyIri, RDF.type, OWL.objectProperty);
      if (property.maxCardinality === 1) addIri(propertyIri, RDF.type, OWL.functionalProperty, "max_cardinality=1");
      addLiteral(propertyIri, RDFS.label, property.label);
      addIri(propertyIri, RDFS.domain, schemaIri(property.domainIri));
      addIri(propertyIri, RDFS.range, schemaIri(property.rangeIri));
    }
  }

  syncRdfNodeType(node, { inferred = false, status = "current", reason = "node class assertion" } = {}) {
    const graphIri = personaGraphIri(node.persona_id);
    const subjectIri = nodeIri(node.id);
    const classIri = schemaIri(classForNodeType(node.type));
    this.upsertRdfTriple({
      personaId: node.persona_id,
      graphIri,
      subjectIri,
      predicateIri: RDF.type,
      objectIri: classIri,
      status,
      inferred,
      reason
    });
    this.upsertRdfTriple({
      personaId: node.persona_id,
      graphIri,
      subjectIri,
      predicateIri: RDFS.label,
      objectLiteral: node.label,
      datatypeIri: XSD.string,
      status,
      inferred: false,
      reason: "node label"
    });
  }

  classAncestors(classIri) {
    const compact = classIri?.startsWith("mem:") ? classIri : compactIri(classIri);
    const ancestors = [];
    let cursor = ONTOLOGY_CLASSES.find((item) => item.iri === compact);
    while (cursor?.parentIri) {
      ancestors.push(schemaIri(cursor.parentIri));
      cursor = ONTOLOGY_CLASSES.find((item) => item.iri === cursor.parentIri);
    }
    return ancestors;
  }

  runReasoner(personaId) {
    this.statements.deleteInferredRdfTriples.run(personaId);
    const graphIri = personaGraphIri(personaId);
    let inferredCount = 0;

    const nodeTypes = this.db.prepare(`
      SELECT node.*, node_type.class_iri
      FROM ontology_node_types node_type
      JOIN nodes node ON node.id = node_type.node_id
      WHERE node_type.persona_id = ?
    `).all(personaId);
    for (const row of nodeTypes) {
      const status = this.statements.getSupersedingEdgeForNode.get(personaId, row.id) ? "replaced" : "current";
      for (const ancestorIri of this.classAncestors(row.class_iri)) {
        this.upsertRdfTriple({
          personaId,
          graphIri,
          subjectIri: nodeIri(row.id),
          predicateIri: RDF.type,
          objectIri: ancestorIri,
          status,
          inferred: true,
          reason: `rdfs:subClassOf closure from ${row.class_iri}`
        });
        inferredCount += 1;
      }
    }

    const currentAssertions = this.db.prepare(`
      SELECT assertion.*, property.relation_type, property.domain_iri, property.range_iri
      FROM ontology_assertions assertion
      JOIN ontology_properties property ON property.iri = assertion.predicate_iri
      WHERE assertion.persona_id = ? AND assertion.status = 'current'
    `).all(personaId);
    for (const assertion of currentAssertions) {
      this.upsertRdfTriple({
        personaId,
        graphIri,
        subjectIri: nodeIri(assertion.subject_node_id),
        predicateIri: RDF.type,
        objectIri: schemaIri(assertion.domain_iri),
        status: "current",
        inferred: true,
        sourceAssertionId: assertion.id,
        reason: `rdfs:domain of ${assertion.predicate_iri}`
      });
      inferredCount += 1;
      if (assertion.object_node_id) {
        this.upsertRdfTriple({
          personaId,
          graphIri,
          subjectIri: nodeIri(assertion.object_node_id),
          predicateIri: RDF.type,
          objectIri: schemaIri(assertion.range_iri),
          status: "current",
          inferred: true,
          sourceAssertionId: assertion.id,
          reason: `rdfs:range of ${assertion.predicate_iri}`
        });
        inferredCount += 1;
      }
    }
    return { inferredCount };
  }

  ensureTemplatePersonas() {
    const timestamp = nowIso();
    const findTemplate = this.db.prepare("SELECT * FROM personas WHERE template_key = ? LIMIT 1");
    const insertTemplate = this.db.prepare(`
      INSERT INTO personas (id, name, description, system_prompt, color, template_key, avatar, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const template of PERSONA_TEMPLATES) {
      if (findTemplate.get(template.templateKey)) continue;
      insertTemplate.run(
        crypto.randomUUID(),
        template.name,
        template.description,
        template.systemPrompt,
        template.color,
        template.templateKey,
        template.avatar,
        timestamp,
        timestamp
      );
    }
  }

  ensureDefaultPersona() {
    const existingTemplate = this.db.prepare("SELECT * FROM personas WHERE template_key = ? AND active = 1 LIMIT 1").get(DEFAULT_PERSONA.templateKey);
    if (existingTemplate) return existingTemplate;
    const existing = this.db.prepare("SELECT * FROM personas WHERE active = 1 ORDER BY created_at ASC LIMIT 1").get();
    if (existing) return existing;
    this.ensureTemplatePersonas();
    return this.db.prepare("SELECT * FROM personas WHERE active = 1 ORDER BY created_at ASC LIMIT 1").get();
  }

  migrateExistingRows(personaId) {
    this.db.prepare("UPDATE sessions SET persona_id = ? WHERE persona_id IS NULL").run(personaId);
    this.db.prepare("UPDATE messages SET persona_id = ? WHERE persona_id IS NULL").run(personaId);
    this.db.prepare("UPDATE memory_events SET persona_id = ? WHERE persona_id IS NULL").run(personaId);
    this.db.prepare("UPDATE edges SET persona_id = ? WHERE persona_id IS NULL").run(personaId);
    this.db.prepare(`
      UPDATE nodes
      SET persona_id = ?, canonical_key = ? || ':' || canonical_key
      WHERE persona_id IS NULL AND canonical_key NOT LIKE ?
    `).run(personaId, personaId, `${personaId}:%`);
    this.db.prepare(`
      DELETE FROM nodes
      WHERE persona_id = ? AND canonical_key IN (?, ?, ?)
    `).run(
      personaId,
      `${personaId}:persona:user`,
      `${personaId}:persona:assistant`,
      `${personaId}:project:persona-universe`
    );
  }

  scopeKey(personaId, canonicalKey) {
    if (canonicalKey.startsWith(`${personaId}:`)) return canonicalKey;
    return `${personaId}:${canonicalKey}`;
  }

  syncOntologyNodeType(node) {
    const classIri = classForNodeType(node.type);
    const timestamp = nowIso();
    this.statements.upsertOntologyNodeType.run(node.id, node.persona_id, classIri, timestamp, timestamp);
    const replaced = Boolean(this.statements.getSupersedingEdgeForNode.get(node.persona_id, node.id));
    this.syncRdfNodeType(node, { status: replaced ? "replaced" : "current" });
    return classIri;
  }

  ontologyClassForNode(node) {
    return this.statements.getOntologyNodeType.get(node.id)?.class_iri || classForNodeType(node.type);
  }

  ensureOntologyProperty(relationType) {
    const property = propertyForRelation(relationType);
    this.statements.upsertOntologyProperty.run(
      property.iri,
      property.relationType,
      property.label,
      property.domainIri,
      property.rangeIri,
      property.maxCardinality,
      property.inverseIri || null,
      property.description || ""
    );
    return property;
  }

  validateOntologyAssertion({ source, target, property }) {
    const sourceClass = this.ontologyClassForNode(source);
    const targetClass = this.ontologyClassForNode(target);
    const domainValid = isClassCompatible(sourceClass, property.domainIri);
    const rangeValid = isClassCompatible(targetClass, property.rangeIri);
    if (domainValid && rangeValid) return { state: "valid", note: "" };
    return {
      state: "warning",
      note: `expected ${property.domainIri} -> ${property.rangeIri}, got ${sourceClass} -> ${targetClass}`
    };
  }

  markObjectAssertionsReplaced({ personaId, objectNodeId }) {
    const timestamp = nowIso();
    const assertions = this.statements.listCurrentAssertionsTouchingNode.all(personaId, objectNodeId, objectNodeId);
    for (const assertion of assertions) {
      if (!["superseded_by", "updates_memory"].includes(assertion.relation_type)) {
        this.statements.markOntologyAssertionStatus.run("replaced", timestamp, assertion.id);
        this.statements.updateRdfTriplesByAssertion.run("replaced", timestamp, personaId, assertion.id);
      }
    }
  }

  applyFunctionalPropertyConstraint({ personaId, assertion, property }) {
    if (property.maxCardinality !== 1 || assertion.status !== "current") return;
    const timestamp = nowIso();
    const candidates = this.statements.listCurrentAssertionsForSubjectPredicate.all(
      personaId,
      assertion.subject_node_id,
      assertion.predicate_iri
    );
    for (const candidate of candidates) {
      if (candidate.id === assertion.id) continue;
      this.statements.markOntologyAssertionStatus.run("replaced", timestamp, candidate.id);
      this.statements.updateRdfTriplesByAssertion.run("replaced", timestamp, personaId, candidate.id);
    }
  }

  syncRdfAssertion(assertion, source, target, property) {
    const graphIri = personaGraphIri(assertion.persona_id);
    this.syncRdfNodeType(source, { status: assertion.status === "replaced" ? "replaced" : "current" });
    this.syncRdfNodeType(target, { status: assertion.status === "replaced" ? "replaced" : "current" });
    this.upsertRdfTriple({
      personaId: assertion.persona_id,
      graphIri,
      subjectIri: nodeIri(assertion.subject_node_id),
      predicateIri: schemaIri(property.iri),
      objectIri: assertion.object_node_id ? nodeIri(assertion.object_node_id) : null,
      objectLiteral: assertion.object_literal || null,
      datatypeIri: assertion.object_literal ? XSD.string : null,
      status: assertion.status,
      inferred: false,
      sourceAssertionId: assertion.id,
      reason: assertion.validation_state === "valid" ? "asserted ontology memory" : assertion.validation_note
    });
  }

  syncOntologyEdge(edge, relationType, eventContext = {}) {
    const source = this.statements.getNodeById.get(edge.source_id);
    const target = this.statements.getNodeById.get(edge.target_id);
    if (!source || !target) return null;

    this.syncOntologyNodeType(source);
    this.syncOntologyNodeType(target);
    const property = this.ensureOntologyProperty(relationType);
    const validation = this.validateOntologyAssertion({ source, target, property });
    const timestamp = nowIso();
    const existing = this.statements.getOntologyAssertion.get(
      edge.persona_id,
      edge.source_id,
      property.iri,
      edge.target_id,
      null
    );
    const correctionRelation = ["superseded_by", "updates_memory"].includes(relationType);
    const touchesReplacedNode = !correctionRelation && (
      this.statements.getSupersedingEdgeForNode.get(edge.persona_id, edge.source_id)
      || this.statements.getSupersedingEdgeForNode.get(edge.persona_id, edge.target_id)
    );
    const status = touchesReplacedNode ? "replaced" : relationType === "updates_memory" ? "historical" : "current";

    let assertionId = existing?.id || crypto.randomUUID();
    if (existing) {
      this.statements.updateOntologyAssertion.run(
        status,
        edge.confidence,
        eventContext.messageId || edge.properties?.evidenceMessageId || null,
        edge.id,
        validation.state,
        validation.note,
        timestamp,
        existing.id
      );
    } else {
      this.statements.insertOntologyAssertion.run(
        assertionId,
        edge.persona_id,
        edge.source_id,
        property.iri,
        edge.target_id,
        null,
        status,
        edge.confidence,
        edge.evidence_count || 1,
        eventContext.messageId || edge.properties?.evidenceMessageId || null,
        edge.id,
        validation.state,
        validation.note,
        timestamp,
        timestamp
      );
    }

    const assertion = this.statements.getOntologyAssertion.get(
      edge.persona_id,
      edge.source_id,
      property.iri,
      edge.target_id,
      null
    );
    this.syncRdfAssertion(assertion, source, target, property);
    this.applyFunctionalPropertyConstraint({ personaId: edge.persona_id, assertion, property });

    if (relationType === "superseded_by") {
      this.markObjectAssertionsReplaced({ personaId: edge.persona_id, objectNodeId: edge.source_id });
    }
    if (!this.bulkMaterializing) this.runReasoner(edge.persona_id);
    return { property, validation };
  }

  normalizePersona(row) {
    if (!row) return null;
    return {
      ...row,
      templateKey: row.template_key,
      systemPrompt: row.system_prompt,
      avatar: row.avatar || row.name?.trim()?.[0] || "P",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  listPersonas() {
    return this.statements.listPersonas.all().map((persona) => this.normalizePersona(persona));
  }

  getPersona(id) {
    if (!id) return null;
    return this.normalizePersona(this.statements.getPersona.get(id));
  }

  getDefaultPersona() {
    const current = this.statements.getPersona.get(this.defaultPersona.id);
    if (current) return this.normalizePersona(current);
    const fallback = this.statements.listPersonas.all()[0];
    if (fallback) {
      this.defaultPersona = fallback;
      return this.normalizePersona(fallback);
    }
    this.ensureTemplatePersonas();
    this.defaultPersona = this.db.prepare("SELECT * FROM personas WHERE active = 1 ORDER BY created_at ASC LIMIT 1").get();
    return this.normalizePersona(this.defaultPersona);
  }

  createPersona({ name, description = "", systemPrompt = "", color = "#facc15", templateKey = null, avatar = "" }) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const resolvedName = name || "새 페르소나";
    this.statements.insertPersona.run(
      id,
      resolvedName,
      description,
      systemPrompt,
      color,
      templateKey,
      avatar || resolvedName.trim()[0] || "P",
      timestamp,
      timestamp
    );
    return this.getPersona(id);
  }

  deletePersona(personaId) {
    const persona = this.statements.getPersona.get(personaId);
    if (!persona) throw new Error("persona not found");
    const activeCount = this.statements.countActivePersonas.get().count;
    if (activeCount <= 1) throw new Error("마지막 페르소나는 삭제할 수 없어요.");

    this.db.exec("BEGIN");
    try {
      this.statements.resetEdges.run(personaId);
      this.statements.resetNodes.run(personaId);
      this.statements.resetEvents.run(personaId);
      this.statements.resetMessages.run(personaId);
      this.statements.resetSessions.run(personaId);
      this.statements.resetOntologyNodeTypes.run(personaId);
      this.statements.resetOntologyAssertions.run(personaId);
      this.statements.resetRdfTriples.run(personaId);
      this.statements.deactivatePersona.run(nowIso(), personaId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    const nextPersona = this.statements.listPersonas.all()[0];
    if (this.defaultPersona.id === personaId && nextPersona) this.defaultPersona = nextPersona;
    return this.normalizePersona(nextPersona);
  }

  resetPersonaMemory(personaId) {
    this.db.exec("BEGIN");
    try {
      this.statements.resetEdges.run(personaId);
      this.statements.resetNodes.run(personaId);
      this.statements.resetEvents.run(personaId);
      this.statements.resetMessages.run(personaId);
      this.statements.resetSessions.run(personaId);
      this.statements.resetOntologyNodeTypes.run(personaId);
      this.statements.resetOntologyAssertions.run(personaId);
      this.statements.resetRdfTriples.run(personaId);
      this.statements.touchPersona.run(nowIso(), personaId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  createSession(title = "새 페르소나 세션", personaId = this.defaultPersona.id) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    this.statements.insertSession.run(id, personaId, title, timestamp, timestamp);
    this.statements.touchPersona.run(timestamp, personaId);
    return this.getSession(id);
  }

  getSession(id) {
    if (!id) return null;
    return this.statements.getSession.get(id);
  }

  getOrCreateDefaultSession(personaId = this.defaultPersona.id) {
    const existing = this.statements.listSessions.all(personaId)[0];
    if (existing) return existing;
    return this.createSession("기억이 열리는 자리", personaId);
  }

  listSessions(personaId = this.defaultPersona.id) {
    return this.statements.listSessions.all(personaId);
  }

  touchSession(sessionId, title) {
    const session = this.getSession(sessionId);
    this.statements.touchSession.run(title || null, nowIso(), sessionId);
    if (session?.persona_id) this.statements.touchPersona.run(nowIso(), session.persona_id);
  }

  updateSessionMemory(sessionId, { compressedSummary = "", workingMemory = "" }) {
    const timestamp = nowIso();
    this.statements.updateSessionMemory.run(compressedSummary, workingMemory, timestamp, timestamp, sessionId);
    const session = this.getSession(sessionId);
    if (session?.persona_id) this.statements.touchPersona.run(timestamp, session.persona_id);
    return this.getSession(sessionId);
  }

  saveMessage({ personaId, sessionId, role, content, provider, model }) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    this.statements.insertMessage.run(id, personaId, sessionId, role, content, provider || null, model || null, timestamp);
    this.touchSession(sessionId);
    return { id, persona_id: personaId, session_id: sessionId, role, content, model_provider: provider, model_name: model, created_at: timestamp };
  }

  listMessages(sessionId) {
    return this.statements.listMessages.all(sessionId);
  }

  listPersonaMessages(personaId, limit = 240) {
    return this.statements.listPersonaMessages.all(personaId, limit);
  }

  upsertNode(input, eventContext = {}) {
    const timestamp = nowIso();
    const personaId = input.personaId || eventContext.personaId || this.defaultPersona.id;
    const canonicalKey = this.scopeKey(personaId, input.canonicalKey);
    const existing = this.statements.getNodeByKey.get(canonicalKey);
    const nextProperties = {
      ...(existing ? parseJson(existing.properties) : {}),
      ...(input.properties || {}),
      memorySource: input.properties?.memorySource || eventContext.messageId || undefined
    };

    if (existing) {
      const updated = {
        ...existing,
        label: input.label || existing.label,
        summary: input.summary || existing.summary,
        importance: clamp(Math.max(existing.importance, input.importance ?? existing.importance) + (input.boostImportance || 0)),
        confidence: clamp(Math.max(existing.confidence, input.confidence ?? existing.confidence)),
        activation: clamp((existing.activation * 0.55) + (input.activation ?? 0.35)),
        properties: stringify(nextProperties),
        updated_at: timestamp,
        last_seen_at: timestamp
      };
      this.statements.updateNode.run(
        updated.label,
        updated.summary,
        updated.importance,
        updated.confidence,
        updated.activation,
        updated.properties,
        updated.updated_at,
        updated.last_seen_at,
        updated.id
      );
      this.syncOntologyNodeType(updated);
      this.recordEvent({
        ...eventContext,
        personaId,
        eventType: "node_reinforced",
        layer: existing.layer,
        nodeId: existing.id,
        summary: `${updated.label} 기억 강화`,
        beforeState: existing,
        afterState: updated
      });
      return { ...updated, properties: nextProperties };
    }

    const node = {
      id: crypto.randomUUID(),
      persona_id: personaId,
      layer: input.layer,
      type: input.type,
      label: input.label,
      summary: input.summary || input.label,
      canonical_key: canonicalKey,
      importance: input.importance ?? 0.55,
      confidence: input.confidence ?? 0.65,
      activation: input.activation ?? 0.45,
      locked: input.locked ? 1 : 0,
      properties: stringify(nextProperties),
      created_at: timestamp,
      updated_at: timestamp,
      last_seen_at: timestamp
    };

    this.statements.insertNode.run(
      node.id,
      node.persona_id,
      node.layer,
      node.type,
      node.label,
      node.summary,
      node.canonical_key,
      node.importance,
      node.confidence,
      node.activation,
      node.locked,
      node.properties,
      node.created_at,
      node.updated_at,
      node.last_seen_at
    );
    this.syncOntologyNodeType(node);
    this.recordEvent({
      ...eventContext,
      personaId,
      eventType: "node_created",
      layer: node.layer,
      nodeId: node.id,
      summary: `${node.label} 기억 생성`,
      afterState: node
    });
    return { ...node, properties: nextProperties };
  }

  upsertEdge(input, eventContext = {}) {
    const timestamp = nowIso();
    const personaId = input.personaId || eventContext.personaId || this.defaultPersona.id;
    const existing = this.statements.getEdgeByUnique.get(personaId, input.sourceId, input.targetId, input.relationType, input.layer);
    const nextProperties = {
      ...(existing ? parseJson(existing.properties) : {}),
      ...(input.properties || {}),
      evidenceMessageId: input.properties?.evidenceMessageId || eventContext.messageId || undefined
    };

    if (existing) {
      const updated = {
        ...existing,
        weight: clamp((existing.weight * 0.65) + (input.weight ?? 0.45)),
        confidence: clamp(Math.max(existing.confidence, input.confidence ?? existing.confidence)),
        activation: clamp((existing.activation * 0.55) + (input.activation ?? 0.35)),
        evidence_count: existing.evidence_count + 1,
        properties: stringify(nextProperties),
        updated_at: timestamp,
        last_seen_at: timestamp
      };
      this.statements.updateEdge.run(
        updated.weight,
        updated.confidence,
        updated.activation,
        updated.evidence_count,
        updated.properties,
        updated.updated_at,
        updated.last_seen_at,
        updated.id
      );
      this.syncOntologyEdge({ ...updated, properties: nextProperties }, input.relationType, eventContext);
      this.recordEvent({
        ...eventContext,
        personaId,
        eventType: "edge_reinforced",
        layer: existing.layer,
        edgeId: existing.id,
        summary: `${input.relationType} 관계 강화`,
        beforeState: existing,
        afterState: updated
      });
      return { ...updated, properties: nextProperties };
    }

    const edge = {
      id: crypto.randomUUID(),
      persona_id: personaId,
      source_id: input.sourceId,
      target_id: input.targetId,
      relation_type: input.relationType,
      layer: input.layer,
      weight: input.weight ?? 0.5,
      confidence: input.confidence ?? 0.65,
      activation: input.activation ?? 0.45,
      evidence_count: 1,
      properties: stringify(nextProperties),
      created_at: timestamp,
      updated_at: timestamp,
      last_seen_at: timestamp
    };

    this.statements.insertEdge.run(
      edge.id,
      edge.persona_id,
      edge.source_id,
      edge.target_id,
      edge.relation_type,
      edge.layer,
      edge.weight,
      edge.confidence,
      edge.activation,
      edge.evidence_count,
      edge.properties,
      edge.created_at,
      edge.updated_at,
      edge.last_seen_at
    );
    this.syncOntologyEdge({ ...edge, properties: nextProperties }, input.relationType, eventContext);
    this.recordEvent({
      ...eventContext,
      personaId,
      eventType: "edge_created",
      layer: edge.layer,
      edgeId: edge.id,
      summary: `${input.relationType} 관계 생성`,
      afterState: edge
    });
    return { ...edge, properties: nextProperties };
  }

  recordEvent({ personaId, sessionId, messageId, eventType, layer, nodeId = null, edgeId = null, summary, beforeState = null, afterState = null }) {
    if (!sessionId) return;
    const eventPersonaId = personaId || this.getSession(sessionId)?.persona_id || this.defaultPersona.id;
    this.statements.insertEvent.run(
      crypto.randomUUID(),
      eventPersonaId,
      sessionId,
      messageId || null,
      eventType,
      layer,
      nodeId,
      edgeId,
      summary,
      beforeState ? stringify(beforeState) : null,
      afterState ? stringify(afterState) : null,
      nowIso()
    );
  }

  getGraph({ personaId = this.defaultPersona.id, sessionId }) {
    const nodes = this.statements.listNodes.all(personaId).map((node) => ({
      ...node,
      properties: parseJson(node.properties)
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = this.statements.listEdges.all(personaId)
      .filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id))
      .map((edge) => ({ ...edge, properties: parseJson(edge.properties) }));
    const events = sessionId ? this.statements.recentEvents.all(personaId, sessionId).map((event) => ({
      ...event,
      before_state: parseJson(event.before_state, null),
      after_state: parseJson(event.after_state, null)
    })) : [];
    const ontologyAssertions = this.statements.listOntologyAssertions.all(personaId, 1200);
    return { nodes, edges, events, ontologyAssertions };
  }

  listRdfTriples(personaId, { includeHistory = false, limit = 5000 } = {}) {
    return this.statements.listRdfTriples.all(personaId, limit)
      .filter((triple) => includeHistory || ["schema", "current"].includes(triple.status));
  }

  parseSparql(query) {
    const prefixes = {
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      mem: "https://persona-universe.local/ontology#",
      node: "urn:persona-universe:node:"
    };
    let body = String(query || "").trim();
    for (const match of body.matchAll(/PREFIX\s+([A-Za-z][\w-]*):\s*<([^>]+)>/gi)) {
      prefixes[match[1]] = match[2];
    }
    body = body.replace(/PREFIX\s+[A-Za-z][\w-]*:\s*<[^>]+>\s*/gi, "").trim();
    const selectMatch = body.match(/SELECT\s+(.+?)\s+WHERE\s*\{([\s\S]+?)\}\s*(?:LIMIT\s+(\d+))?/i);
    if (!selectMatch) throw new Error("Only SELECT ... WHERE { ... } SPARQL queries are supported");
    const vars = selectMatch[1].trim() === "*"
      ? null
      : selectMatch[1].trim().split(/\s+/).filter((item) => item.startsWith("?")).map((item) => item.slice(1));
    const limit = Number(selectMatch[3] || 100);
    const patternText = selectMatch[2]
      .replace(/#[^\n]*/g, "")
      .split(/\s+\.\s*|\s*\.\s*\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const expandToken = (token) => {
      if (token === "a") return { type: "iri", value: RDF.type };
      if (token.startsWith("?")) return { type: "var", value: token.slice(1) };
      if (token.startsWith("<") && token.endsWith(">")) return { type: "iri", value: token.slice(1, -1) };
      if (token.startsWith("\"")) {
        const literal = token.match(/^"((?:\\"|[^"])*)"/)?.[1] || "";
        return { type: "literal", value: literal.replace(/\\"/g, "\"") };
      }
      const prefixed = token.match(/^([A-Za-z][\w-]*):(.+)$/);
      if (prefixed && prefixes[prefixed[1]]) return { type: "iri", value: `${prefixes[prefixed[1]]}${prefixed[2]}` };
      return { type: "iri", value: expandIri(token) };
    };
    const patterns = patternText.map((pattern) => {
      const parts = pattern.match(/"[^"]*"|<[^>]+>|\S+/g) || [];
      if (parts.length < 3) throw new Error(`Invalid SPARQL triple pattern: ${pattern}`);
      return {
        subject: expandToken(parts[0]),
        predicate: expandToken(parts[1]),
        object: expandToken(parts.slice(2).join(" "))
      };
    });
    const allVars = vars || [...new Set(patterns.flatMap((pattern) => [pattern.subject, pattern.predicate, pattern.object]
      .filter((term) => term.type === "var")
      .map((term) => term.value)))];
    return { vars: allVars, patterns, limit };
  }

  runSparql({ personaId = this.defaultPersona.id, query }) {
    const parsed = this.parseSparql(query);
    const triples = this.listRdfTriples(personaId, { limit: 12000 });
    const tripleTerm = (triple, position) => {
      if (position === "subject") return { type: "iri", value: triple.subject_iri };
      if (position === "predicate") return { type: "iri", value: triple.predicate_iri };
      return triple.object_kind === "iri"
        ? { type: "iri", value: triple.object_iri }
        : { type: "literal", value: triple.object_literal, datatype: triple.datatype_iri, language: triple.language };
    };
    const bindTerm = (bindings, patternTerm, actualTerm) => {
      if (patternTerm.type === "var") {
        const existing = bindings[patternTerm.value];
        if (existing) return existing.type === actualTerm.type && existing.value === actualTerm.value;
        bindings[patternTerm.value] = actualTerm;
        return true;
      }
      return patternTerm.type === actualTerm.type && patternTerm.value === actualTerm.value;
    };
    let bindings = [{}];
    for (const pattern of parsed.patterns) {
      const nextBindings = [];
      for (const binding of bindings) {
        for (const triple of triples) {
          const candidate = { ...binding };
          if (!bindTerm(candidate, pattern.subject, tripleTerm(triple, "subject"))) continue;
          if (!bindTerm(candidate, pattern.predicate, tripleTerm(triple, "predicate"))) continue;
          if (!bindTerm(candidate, pattern.object, tripleTerm(triple, "object"))) continue;
          nextBindings.push(candidate);
          if (nextBindings.length >= parsed.limit * 4) break;
        }
      }
      bindings = nextBindings.slice(0, parsed.limit);
    }
    const rows = bindings.slice(0, parsed.limit).map((binding) => Object.fromEntries(parsed.vars.map((name) => {
      const term = binding[name];
      return [name, term ? (term.type === "iri" ? compactIri(term.value) : term.value) : null];
    })));
    return {
      head: { vars: parsed.vars },
      results: {
        bindings: rows.map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [
          name,
          value?.startsWith?.("<") || value?.includes?.(":")
            ? { type: "uri", value }
            : { type: "literal", value }
        ])))
      },
      rows
    };
  }

  turtleTermForTriple(triple) {
    const term = (iri) => compactIri(iri);
    if (triple.object_kind === "iri") return `${term(triple.subject_iri)} ${term(triple.predicate_iri)} ${term(triple.object_iri)} .`;
    const escaped = String(triple.object_literal || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const datatype = triple.datatype_iri ? `^^${term(triple.datatype_iri)}` : "";
    const lang = triple.language ? `@${triple.language}` : "";
    return `${term(triple.subject_iri)} ${term(triple.predicate_iri)} "${escaped}"${lang || datatype} .`;
  }

  exportOntologyTurtle(personaId = this.defaultPersona.id) {
    const triples = this.listRdfTriples(personaId, { includeHistory: true, limit: 20000 });
    const prefixes = [
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
      "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
      "@prefix mem: <https://persona-universe.local/ontology#> .",
      "@prefix node: <urn:persona-universe:node:> .",
      "@prefix graph: <urn:persona-universe:graph:> ."
    ];
    const lines = triples.map((triple) => this.turtleTermForTriple(triple));
    return `${prefixes.join("\n")}\n\n${lines.join("\n")}\n`;
  }

  validateOntology(personaId = this.defaultPersona.id) {
    const warnings = this.db.prepare(`
      SELECT assertion.*, property.relation_type
      FROM ontology_assertions assertion
      JOIN ontology_properties property ON property.iri = assertion.predicate_iri
      WHERE assertion.persona_id = ? AND assertion.validation_state != 'valid'
    `).all(personaId);
    const functionalViolations = this.db.prepare(`
      SELECT subject_node_id, predicate_iri, COUNT(*) AS count
      FROM ontology_assertions assertion
      JOIN ontology_properties property ON property.iri = assertion.predicate_iri
      WHERE assertion.persona_id = ?
        AND assertion.status = 'current'
        AND property.max_cardinality = 1
      GROUP BY subject_node_id, predicate_iri
      HAVING COUNT(*) > 1
    `).all(personaId);
    const currentTouchingReplaced = this.db.prepare(`
      SELECT assertion.id, property.relation_type
      FROM ontology_assertions assertion
      JOIN ontology_properties property ON property.iri = assertion.predicate_iri
      WHERE assertion.persona_id = ?
        AND assertion.status = 'current'
        AND property.relation_type NOT IN ('superseded_by', 'updates_memory')
        AND (
          EXISTS (SELECT 1 FROM edges edge WHERE edge.persona_id = assertion.persona_id AND edge.source_id = assertion.subject_node_id AND edge.relation_type = 'superseded_by')
          OR EXISTS (SELECT 1 FROM edges edge WHERE edge.persona_id = assertion.persona_id AND edge.source_id = assertion.object_node_id AND edge.relation_type = 'superseded_by')
        )
    `).all(personaId);
    const rdfCounts = this.db.prepare(`
      SELECT
        COUNT(*) AS triples,
        SUM(CASE WHEN inferred = 1 THEN 1 ELSE 0 END) AS inferred,
        SUM(CASE WHEN status = 'replaced' THEN 1 ELSE 0 END) AS replaced
      FROM rdf_triples
      WHERE persona_id IN ('__schema__', ?)
    `).get(personaId);
    return {
      ok: warnings.length === 0 && functionalViolations.length === 0 && currentTouchingReplaced.length === 0,
      warnings,
      functionalViolations,
      currentTouchingReplaced,
      rdf: rdfCounts
    };
  }

  getTopNodes(personaId, layer, limit = 8) {
    return this.statements.topNodesByLayer.all(personaId, layer, limit).map((node) => ({
      ...node,
      properties: parseJson(node.properties)
    }));
  }
}
