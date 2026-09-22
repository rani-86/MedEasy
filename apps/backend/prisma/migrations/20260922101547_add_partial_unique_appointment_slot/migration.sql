-- DropIndex
DROP INDEX "appointments_doctor_id_slot_start_key";
CREATE UNIQUE INDEX uq_doctor_active_slot 
ON appointments (doctor_id, slot_start) 
WHERE status = 'booked';