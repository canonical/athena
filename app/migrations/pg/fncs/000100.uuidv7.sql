-- UUIDv7 function for generating time-ordered UUIDs (compatible with Postgres<18)
CREATE OR REPLACE FUNCTION uuidv7()
RETURNS uuid
AS $$
BEGIN
  RETURN encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex')::uuid;
END
$$
LANGUAGE plpgsql
VOLATILE;