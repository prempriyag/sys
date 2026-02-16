-- SQL: create table and insert scanned card data
CREATE TABLE IF NOT EXISTS scanned_cards (
  record_no SERIAL PRIMARY KEY,
  card_no INTEGER,
  ref_id TEXT,
  name TEXT,
  relation_role TEXT,
  relation_name TEXT,
  house_number TEXT,
  age INTEGER,
  gender TEXT,
  photo_available BOOLEAN
);

-- Inserts
INSERT INTO scanned_cards (card_no, ref_id, name, relation_role, relation_name, house_number, age, gender, photo_available) VALUES
(7, 'FBT2224673', 'Meharahbanu', 'Husband', 'Varisamohammed', '23/29, sanjay Gandhi nagar', 54, 'Female', TRUE),
(8, 'WQD2815132', 'SHOBANA', 'Father', 'NAGARAJ', '30', 22, 'Female', TRUE),
(9, 'WQD2707750', 'VANMATHI M', 'Husband', 'MANIKANDAN', '30B', 27, 'Female', TRUE);
