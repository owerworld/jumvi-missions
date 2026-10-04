-- US-only daily totals. No visitor, session, IP, nickname, history or exact event time.
CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL CHECK(length(day)=10),
  locale TEXT NOT NULL CHECK(locale IN ('en-US','tr')),
  mission TEXT NOT NULL CHECK(mission='none' OR (mission GLOB 'm[0-3][0-9]' AND mission BETWEEN 'm01' AND 'm36')),
  event TEXT NOT NULL CHECK(event IN ('app_open','mission_open','round_start','help_open','round_stop','round_resume','completion_reported')),
  count INTEGER NOT NULL DEFAULT 1 CHECK(count > 0),
  PRIMARY KEY(day, locale, mission, event),
  CHECK((event='app_open' AND mission='none') OR (event!='app_open' AND mission!='none'))
) WITHOUT ROWID;
