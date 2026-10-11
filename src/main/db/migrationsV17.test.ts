import { it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { releasedV15Database } from '../testFixtures/releasedV15Database'
import { AGENT_RESOURCE_CLEANUP_SCHEMA_SQL, SCAN_AUDIT_ENTRIES_SCHEMA_SQL } from './schema'
import { CURRENT_SCHEMA_VERSION, migrateDatabase } from './migrations'

function oldDatabase(version: 15 | 16): Database.Database {
  const db = releasedV15Database()
  if (version === 16) {
    db.exec(AGENT_RESOURCE_CLEANUP_SCHEMA_SQL)
    db.exec('DROP INDEX idx_video_tag_tag_id; CREATE INDEX idx_video_tag_tag_id ON video_tag(tag_id,origin)')
    db.exec(SCAN_AUDIT_ENTRIES_SCHEMA_SQL)
    db.pragma('user_version = 16')
  }
  for (const [index, sort] of ['add_time', 'release_date', 'rating', 'code'].entries()) {
    const id = index + 2
    db.prepare("INSERT INTO media_libraries(id,name,status,revision) VALUES (?,?,'archived',8)").run(id, `Old ${sort}`)
    db.prepare(`INSERT INTO media_library_configs
      (library_id,auto_scan_enabled,auto_scan_interval_minutes,min_import_duration_minutes,
       auto_merge_same_code_resources,remove_resource_less_memberships,auto_import_local_nfo,
       default_video_scraper,default_sort_by,default_sort_dir,include_in_home_discovery,revision,legacy_settings_imported_at)
      VALUES (?,1,120,11,0,1,0,? ,?,'asc',0,9,'old timestamp')`).run(id, index % 2 ? null : 'JavLibrary', sort)
  }
  db.exec("INSERT INTO videos(id,code,rating) VALUES (1,'PRESERVED',5); INSERT INTO video_external_stats(video_id,source,rating_average) VALUES (1,'JavDB',4.3)")
  return db
}
function schema(db: Database.Database) {
  return db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ type: string; name: string; tbl_name: string; sql: string }>
}
function normalize(sql: string) { return sql.replace('CREATE TABLE "media_library_configs"', 'CREATE TABLE media_library_configs') }
function snapshot(db: Database.Database) {
  return schema(db).filter(row => row.type === 'table').map(({ name }) => ({ name,
    rows: db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all() }))
}
function assertSortConstraint(db: Database.Database) {
  db.prepare("UPDATE media_library_configs SET default_sort_by='external_rating' WHERE library_id=1").run()
  assert.equal((db.prepare('SELECT default_sort_by FROM media_library_configs WHERE library_id=1').get() as { default_sort_by: string }).default_sort_by, 'external_rating')
  assert.throws(() => db.exec("UPDATE media_library_configs SET default_sort_by='invalid' WHERE library_id=1"), /CHECK/)
  assert.throws(() => db.exec("UPDATE media_library_configs SET default_sort_dir='invalid' WHERE library_id=1"), /CHECK/)
  assert.throws(() => db.exec('UPDATE media_library_configs SET auto_scan_enabled=2 WHERE library_id=1'), /CHECK/)
  assert.throws(() => db.exec('UPDATE media_library_configs SET library_id=999 WHERE library_id=1'), /FOREIGN KEY/)
}

for (const version of [15, 16] as const) {
  it(`upgrades schema ${version} through V17 preserving every business row and all other config DDL`, () => {
    const db = oldDatabase(version)
    try {
      const before = snapshot(db)
      const ddl = schema(db)
      const columns = db.pragma('table_info(media_library_configs)')
      const foreignKeys = db.pragma('foreign_key_list(media_library_configs)')
      const indexes = db.pragma('index_list(media_library_configs)')
      assert.throws(() => db.exec("UPDATE media_library_configs SET default_sort_by='external_rating'"), /CHECK/)
      migrateDatabase(db)
      assert.equal(CURRENT_SCHEMA_VERSION, 17)
      assert.equal(db.pragma('user_version', { simple: true }), 17)
      for (const table of before) assert.deepEqual(db.prepare(`SELECT * FROM "${table.name}"`).all(), table.rows)
      const after = schema(db)
      for (const old of ddl) {
        if (version === 15 && old.name === 'idx_video_tag_tag_id') continue
        const current = after.find(row => row.name === old.name)!
        assert.equal(normalize(current.sql), old.name === 'media_library_configs'
          ? old.sql.replace("'rating', 'code'", "'rating', 'external_rating', 'code'") : old.sql)
      }
      assert.deepEqual(db.pragma('table_info(media_library_configs)'), columns)
      assert.deepEqual(db.pragma('foreign_key_list(media_library_configs)'), foreignKeys)
      assert.deepEqual(db.pragma('index_list(media_library_configs)'), indexes)
      const migrated = schema(db)
      migrateDatabase(db)
      assert.deepEqual(schema(db), migrated)
      assertSortConstraint(db)
      assert.deepEqual(db.pragma('foreign_key_check'), [])
      assert.deepEqual(db.pragma('integrity_check'), [{ integrity_check: 'ok' }])
    } finally { db.close() }
  })
}
it('allows external_rating in a fresh database while retaining CHECK and foreign key constraints', () => {
  const db = new Database(':memory:')
  try {
    db.pragma('foreign_keys = ON')
    migrateDatabase(db)
    assert.equal(db.pragma('user_version', { simple: true }), 17)
    assertSortConstraint(db)
  } finally { db.close() }
})
for (const phase of ['INSERT INTO media_library_configs_v17', 'DROP TABLE media_library_configs', 'ALTER TABLE media_library_configs_v17'] as const) {
  it(`rolls back V17 data, DDL and version on failure after ${phase}`, t => {
    const db = oldDatabase(16)
    try {
      const before = snapshot(db), ddl = schema(db)
      const exec = db.exec
      t.mock.method(db, 'exec', (sql: string) => {
        const result = exec.call(db, sql)
        if (sql.startsWith(phase)) throw new Error('injected V17 failure')
        return result
      })
      assert.throws(() => migrateDatabase(db), /injected V17 failure/)
      assert.equal(db.pragma('user_version', { simple: true }), 16)
      assert.equal(db.pragma('foreign_keys', { simple: true }), 1)
      assert.deepEqual(schema(db), ddl)
      assert.deepEqual(snapshot(db), before)
      assert.deepEqual(db.pragma('foreign_key_check'), [])
    } finally { t.mock.restoreAll(); db.close() }
  })
}
it('recreates existing explicit config indexes and triggers without firing them during copying', () => {
  const db = oldDatabase(16)
  try {
    db.exec(`CREATE INDEX config_scraper ON media_library_configs(default_video_scraper);
      CREATE TRIGGER config_revision AFTER UPDATE ON media_library_configs BEGIN
        UPDATE media_libraries SET revision=revision+1 WHERE id=NEW.library_id; END;`)
    const rows = snapshot(db), objects = schema(db).filter(row => row.name.startsWith('config_'))
    migrateDatabase(db)
    for (const table of rows) assert.deepEqual(db.prepare(`SELECT * FROM "${table.name}"`).all(), table.rows)
    assert.deepEqual(schema(db).filter(row => row.name.startsWith('config_')), objects)
  } finally { db.close() }
})
