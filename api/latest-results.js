
export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=300"
  );

  try {
    const year = new Date().getUTCFullYear();

    // 올해 F1 세션 목록 가져오기
    const sessionsResponse = await fetch(
      `https://api.openf1.org/v1/sessions?year=${year}`
    );

    if (!sessionsResponse.ok) {
      throw new Error("세션 목록을 불러오지 못했습니다.");
    }

    const sessions = await sessionsResponse.json();
    const now = Date.now();

    // 가장 최근에 종료된 레이스 찾기
    const races = sessions
      .filter(session =>
        session.session_name === "Race" &&
        session.date_end &&
        new Date(session.date_end).getTime() <= now
      )
      .sort((a, b) =>
        new Date(b.date_end) - new Date(a.date_end)
      );

    if (races.length === 0) {
      return res.status(200).json({
        ok: true,
        message: "아직 완료된 레이스가 없습니다.",
        race: null,
        sessions: []
      });
    }

    const race = races[0];

    // 같은 경기 주말의 연습 주행, 퀄리파잉, 레이스 찾기
    const weekend = sessions
      .filter(session =>
        session.meeting_key === race.meeting_key &&
        ["Practice 1", "Practice 2", "Practice 3",
         "Qualifying", "Race"].includes(session.session_name) &&
        session.date_end &&
        new Date(session.date_end).getTime() <= now
      )
      .sort((a, b) =>
        new Date(a.date_start) - new Date(b.date_start)
      );

    // 각 세션의 결과와 드라이버 정보 가져오기
    const results = await Promise.all(
      weekend.map(async session => {
        try {
          const [resultResponse, driverResponse] =
            await Promise.all([
              fetch(
                `https://api.openf1.org/v1/session_result?session_key=${session.session_key}`
              ),
              fetch(
                `https://api.openf1.org/v1/drivers?session_key=${session.session_key}`
              )
            ]);

          if (!resultResponse.ok || !driverResponse.ok) {
            return {
              name: session.session_name,
              date: session.date_start,
              results: []
            };
          }

          const [rows, drivers] = await Promise.all([
            resultResponse.json(),
            driverResponse.json()
          ]);

          const driverMap = new Map(
            drivers.map(driver => [
              Number(driver.driver_number),
              driver
            ])
          );

          rows.sort((a, b) =>
            (a.position ?? 999) - (b.position ?? 999)
          );

          return {
            name: session.session_name,
            date: session.date_start,
            results: rows.map(row => {
              const driver = driverMap.get(
                Number(row.driver_number)
              ) || {};

              return {
                position: row.position ?? null,
                driver_number: row.driver_number ?? null,
                name: driver.full_name || "이름 없음",
                team: driver.team_name || "팀 정보 없음",
                team_colour: (
                  driver.team_colour || "FFFFFF"
                ).replace("#", ""),
                points: row.points ?? null,
                duration: row.duration ?? null,
                gap: row.gap_to_leader ?? null
              };
            })
          };
        } catch (error) {
          console.error("세션 결과 오류:", error);

          return {
            name: session.session_name,
            date: session.date_start,
            results: []
          };
        }
      })
    );

    return res.status(200).json({
      ok: true,
      source: "OpenF1",
      race: {
        name: race.meeting_name,
        date: race.date_start
      },
      sessions: results
    });

  } catch (error) {
    console.error("F1 results API 오류:", error);

    return res.status(502).json({
      ok: false,
      message: "경기 결과를 불러오지 못했습니다."
    });
  }
}
