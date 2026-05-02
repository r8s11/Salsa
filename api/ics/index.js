const UPSTREAM = {
  boston:
    "https://golatindance.com/events/category/boston/?post_type=tribe_events&ical=1&eventDisplay=list",
  "new-york-city":
    "https://golatindance.com/events/category/new-york-city/?post_type=tribe_events&ical=1&eventDisplay=list",
};

module.exports = async function (context, req) {
  const city = req.query.city;

  if (!Object.prototype.hasOwnProperty.call(UPSTREAM, city)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Unknown city. Expected 'boston' or 'new-york-city'." },
    };
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM[city], {
      headers: { Accept: "text/calendar, text/plain, */*" },
    });

    if (!upstream.ok) {
      context.res = {
        status: 502,
        headers: { "Content-Type": "application/json" },
        body: { error: `Upstream returned ${upstream.status}` },
      };
      return;
    }

    const body = await upstream.text();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
      body,
    };
  } catch (err) {
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: { error: "Failed to fetch upstream calendar." },
    };
    context.log.error("ics proxy error", err);
  }
};
