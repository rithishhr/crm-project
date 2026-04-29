import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'crm.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb();
  }
  return db;
}

function initDb() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales_rep' CHECK(role IN ('admin','manager','sales_rep')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','unqualified')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      source TEXT,
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      industry TEXT,
      website TEXT,
      address TEXT,
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      total_value REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      value REAL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'prospecting' CHECK(stage IN ('prospecting','qualification','proposal','negotiation','closed_won','closed_lost')),
      probability INTEGER DEFAULT 10,
      expected_close DATE,
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATETIME,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
      assigned_to INTEGER REFERENCES users(id),
      related_to_type TEXT CHECK(related_to_type IN ('lead','client','deal')),
      related_to_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('email','call','meeting','note')),
      description TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      related_to_type TEXT CHECK(related_to_type IN ('lead','client','deal')),
      related_to_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','failed')),
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if already seeded
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) return;

  seedData(database);
}

function seedData(database: Database.Database) {
  const password = bcrypt.hashSync('password123', 10);

  // Insert users
  const insertUser = database.prepare(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
  );
  const admin = insertUser.run('admin@crm.com', password, 'Admin User', 'admin');
  const manager = insertUser.run('manager@crm.com', password, 'Sarah Manager', 'manager');
  const sales1 = insertUser.run('john@crm.com', password, 'John Sales', 'sales_rep');
  const sales2 = insertUser.run('jane@crm.com', password, 'Jane Sales', 'sales_rep');

  const adminId = admin.lastInsertRowid;
  const managerId = manager.lastInsertRowid;
  const sales1Id = sales1.lastInsertRowid;
  const sales2Id = sales2.lastInsertRowid;

  // Insert leads
  const insertLead = database.prepare(
    'INSERT INTO leads (name, email, phone, company, status, priority, source, assigned_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertLead.run('Alice Johnson', 'alice@techcorp.com', '555-0101', 'TechCorp Inc', 'new', 'high', 'Website', sales1Id, 'Interested in enterprise plan');
  insertLead.run('Bob Williams', 'bob@startupxyz.com', '555-0102', 'Startup XYZ', 'contacted', 'medium', 'Referral', sales1Id, 'Called twice, needs follow-up');
  insertLead.run('Carol Davis', 'carol@bigbiz.com', '555-0103', 'BigBiz Ltd', 'qualified', 'high', 'LinkedIn', sales2Id, 'Ready for demo');
  insertLead.run('David Brown', 'david@mediaco.com', '555-0104', 'MediaCo', 'contacted', 'low', 'Cold Call', sales2Id, 'Showed some interest');
  insertLead.run('Eve Martinez', 'eve@fintech.com', '555-0105', 'FinTech Solutions', 'qualified', 'high', 'Trade Show', sales1Id, 'Very interested, budget approved');
  insertLead.run('Frank Wilson', 'frank@retailplus.com', '555-0106', 'RetailPlus', 'unqualified', 'low', 'Website', managerId, 'Not a good fit currently');
  insertLead.run('Grace Lee', 'grace@cloudtech.com', '555-0107', 'CloudTech', 'new', 'medium', 'Email Campaign', sales2Id, 'Responded to newsletter');

  // Insert clients
  const insertClient = database.prepare(
    'INSERT INTO clients (name, email, phone, company, industry, website, address, assigned_to, notes, total_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const client1 = insertClient.run('Michael Chen', 'michael@globalinc.com', '555-0201', 'Global Inc', 'Technology', 'https://globalinc.com', '100 Main St, NY', sales1Id, 'Long-term client since 2021', 125000);
  const client2 = insertClient.run('Lisa Thompson', 'lisa@innovation.com', '555-0202', 'Innovation Co', 'Healthcare', 'https://innovation.com', '200 Oak Ave, CA', sales2Id, 'Recently upgraded to premium', 87500);
  const client3 = insertClient.run('Robert Garcia', 'robert@buildpro.com', '555-0203', 'BuildPro LLC', 'Construction', 'https://buildpro.com', '300 Pine Rd, TX', sales1Id, 'Multiple locations', 210000);
  const client4 = insertClient.run('Amanda White', 'amanda@ecogreen.com', '555-0204', 'EcoGreen Corp', 'Energy', 'https://ecogreen.com', '400 Elm St, WA', managerId, 'Expanding rapidly', 165000);

  const client1Id = client1.lastInsertRowid;
  const client2Id = client2.lastInsertRowid;
  const client3Id = client3.lastInsertRowid;
  const client4Id = client4.lastInsertRowid;

  // Insert deals
  const insertDeal = database.prepare(
    'INSERT INTO deals (title, client_id, value, stage, probability, expected_close, assigned_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const deal1 = insertDeal.run('Global Inc Enterprise License', client1Id, 45000, 'negotiation', 75, '2024-07-30', sales1Id, 'Final pricing discussion');
  const deal2 = insertDeal.run('Innovation Co Platform Upgrade', client2Id, 28000, 'proposal', 50, '2024-08-15', sales2Id, 'Proposal sent, awaiting feedback');
  const deal3 = insertDeal.run('BuildPro Multi-Site License', client3Id, 92000, 'closed_won', 100, '2024-06-01', sales1Id, 'Contract signed!');
  const deal4 = insertDeal.run('EcoGreen Annual Subscription', client4Id, 36000, 'qualification', 30, '2024-09-01', managerId, 'Needs technical evaluation');
  const deal4Id = deal4.lastInsertRowid;
  const deal5 = insertDeal.run('TechCorp Starter Package', client1Id, 12000, 'prospecting', 10, '2024-10-01', sales1Id, 'Initial discussions');
  const deal6 = insertDeal.run('MediaCo Basic Plan', client2Id, 8000, 'closed_lost', 0, '2024-05-15', sales2Id, 'Lost to competitor');
  const deal7 = insertDeal.run('EcoGreen Expansion Deal', client4Id, 55000, 'proposal', 60, '2024-08-30', managerId, 'Detailed proposal submitted');

  const deal1Id = deal1.lastInsertRowid;
  const deal2Id = deal2.lastInsertRowid;
  const deal3Id = deal3.lastInsertRowid;

  // Insert tasks
  const insertTask = database.prepare(
    'INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, related_to_type, related_to_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const today = new Date();

  insertTask.run('Follow up with Alice Johnson', 'Call to discuss enterprise plan requirements', tomorrow.toISOString(), 'high', 'pending', sales1Id, 'lead', 1);
  insertTask.run('Send proposal to Carol Davis', 'Prepare and send detailed proposal document', today.toISOString(), 'high', 'in_progress', sales2Id, 'lead', 3);
  insertTask.run('Schedule demo for Eve Martinez', 'Set up product demonstration', tomorrow.toISOString(), 'high', 'pending', sales1Id, 'lead', 5);
  insertTask.run('Review BuildPro contract', 'Final review before signing', yesterday.toISOString(), 'medium', 'completed', sales1Id, 'deal', Number(deal3Id));
  insertTask.run('Prepare Q3 report', 'Compile quarterly performance metrics', nextWeek.toISOString(), 'medium', 'pending', managerId, null, null);
  insertTask.run('Update Global Inc account', 'Add recent meeting notes', today.toISOString(), 'low', 'pending', sales1Id, 'client', Number(client1Id));
  insertTask.run('Send invoice to BuildPro', 'Invoice for closed deal', yesterday.toISOString(), 'high', 'completed', sales1Id, 'deal', Number(deal3Id));
  insertTask.run('Research EcoGreen competitors', 'Competitive analysis for proposal', nextWeek.toISOString(), 'medium', 'in_progress', managerId, 'deal', Number(deal4Id));

  // Insert activities
  const insertActivity = database.prepare(
    'INSERT INTO activities (type, description, user_id, related_to_type, related_to_id) VALUES (?, ?, ?, ?, ?)'
  );
  insertActivity.run('call', 'Initial discovery call with Alice Johnson - very promising', sales1Id, 'lead', 1);
  insertActivity.run('email', 'Sent product brochure to Bob Williams', sales1Id, 'lead', 2);
  insertActivity.run('meeting', 'Product demo with Carol Davis - she loved the features', sales2Id, 'lead', 3);
  insertActivity.run('email', 'Proposal sent to Innovation Co', sales2Id, 'client', Number(client2Id));
  insertActivity.run('meeting', 'Contract signing with BuildPro LLC', sales1Id, 'deal', Number(deal3Id));
  insertActivity.run('call', 'Negotiation call with Global Inc - positive progress', sales1Id, 'deal', Number(deal1Id));
  insertActivity.run('note', 'EcoGreen requires technical assessment before proceeding', managerId, 'deal', Number(deal4Id));
  insertActivity.run('email', 'Welcome email sent to new client Robert Garcia', sales1Id, 'client', Number(client3Id));

  console.log('Database seeded successfully');
}

export default getDb;
