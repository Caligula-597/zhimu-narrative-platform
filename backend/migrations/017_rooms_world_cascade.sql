-- Allow deleting a world after its parallel rooms are removed (or cascade from world delete).
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_world_id_fkey;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE;
