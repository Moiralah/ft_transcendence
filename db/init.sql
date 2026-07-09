CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT,
  mother_id UUID REFERENCES persons(id),
  father_id UUID REFERENCES persons(id),
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Jane (mother) and John (father) first, then Janette referencing both.
INSERT INTO persons (name, gender, birth_date)
VALUES ('Jane', 'female', '1980-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO persons (name, gender, birth_date)
VALUES ('John', 'male', '1979-05-12')
ON CONFLICT DO NOTHING;

INSERT INTO persons (name, gender, mother_id, father_id, birth_date)
SELECT 'Janette', 'female', m.id, f.id, '2005-09-23'
FROM persons m, persons f
WHERE m.name = 'Jane' AND f.name = 'John'
ON CONFLICT DO NOTHING;
