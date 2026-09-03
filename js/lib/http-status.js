// Every status carries what it means, when to reach for it and what people
// reach for instead by mistake.

export const CLASSES = {
  1: { name: 'Informational', blurb: 'The request was received and the work carries on.' },
  2: { name: 'Success', blurb: 'The request was received, understood and accepted.' },
  3: { name: 'Redirection', blurb: 'Something else has to happen to finish the request.' },
  4: { name: 'Client error', blurb: 'The request was wrong, so sending it again unchanged will not help.' },
  5: { name: 'Server error', blurb: 'The request was fine, the server could not carry it out.' },
};

export const STATUSES = [
  {
    code: 100,
    name: 'Continue',
    summary: 'The client should carry on with its request.',
    uses: [
      'A client sent Expect: 100-continue before a large upload, and the server is saying the headers look fine.',
      'Saving a client from sending a body that was going to be rejected anyway.',
    ],
    notes: 'Sent by the server on its own, before the real response. Most client libraries handle it without you seeing it.',
    related: [417],
    rfc: 'RFC 9110 §15.2.1',
  },
  {
    code: 101,
    name: 'Switching Protocols',
    summary: 'The connection is changing to another protocol.',
    uses: [
      'Completing a WebSocket handshake after the client sent Upgrade: websocket.',
      'Moving a connection to a newer version of HTTP the client asked for.',
    ],
    notes: 'The server only switches to a protocol the client named in Upgrade.',
    related: [426],
    rfc: 'RFC 9110 §15.2.2',
  },
  {
    code: 103,
    name: 'Early Hints',
    summary: 'Hints about what to load, sent before the real response.',
    uses: [
      'Sending Link headers for stylesheets and fonts while the page itself is still being put together.',
      'Letting a browser start fetching what it will need while a slow database query finishes.',
    ],
    notes: 'A real response still follows. Only useful when the final response takes a while to build.',
    related: [200],
    rfc: 'RFC 8297',
  },

  {
    code: 200,
    name: 'OK',
    summary: 'The request succeeded.',
    uses: [
      'A GET that found the thing asked for, with the thing in the body.',
      'A POST or PUT that changed something and is returning the new state.',
      'A search that matched nothing, since an empty list is still a successful answer.',
    ],
    notes: 'An empty result is not an error. Returning 404 for a search with no matches confuses "nothing matched" with "this endpoint does not exist".',
    related: [201, 204, 404],
    rfc: 'RFC 9110 §15.3.1',
  },
  {
    code: 201,
    name: 'Created',
    summary: 'The request succeeded and something new exists because of it.',
    uses: [
      'A POST that made a new record, with a Location header pointing at it.',
      'A PUT to a URL that did not exist yet and now does.',
    ],
    notes: 'Send a Location header. Without it the client has to guess where the new thing lives.',
    related: [200, 202, 204],
    rfc: 'RFC 9110 §15.3.2',
  },
  {
    code: 202,
    name: 'Accepted',
    summary: 'The request was taken in but the work has not finished.',
    uses: [
      'Queueing a long job, returning a URL the client can poll for progress.',
      'Accepting a batch import that a worker will process later.',
    ],
    notes: 'A promise, not a result. Say where to look for the outcome, because 202 alone leaves the client with nothing to do next.',
    related: [201, 303],
    rfc: 'RFC 9110 §15.3.3',
  },
  {
    code: 204,
    name: 'No Content',
    summary: 'It worked, and there is deliberately nothing to send back.',
    uses: [
      'A DELETE that removed the thing.',
      'A PUT or PATCH where the client already knows the new state.',
      'A form saved by a script that is going to stay on the same page.',
    ],
    notes: 'Must have no body at all. A body with 204 is a protocol error, and some clients will hang waiting for one.',
    related: [200, 205],
    rfc: 'RFC 9110 §15.3.5',
  },
  {
    code: 206,
    name: 'Partial Content',
    summary: 'Part of the thing, because part is what was asked for.',
    uses: [
      'Serving a byte range so a video can be scrubbed without downloading it all.',
      'Resuming a download that was interrupted.',
    ],
    notes: 'Answers a Range header, and carries Content-Range saying which part this is.',
    related: [200, 416],
    rfc: 'RFC 9110 §15.3.7',
  },

  {
    code: 301,
    name: 'Moved Permanently',
    summary: 'This address is finished, use the new one from now on.',
    uses: [
      'Moving a site to a new domain, so search engines carry the ranking across.',
      'Settling on one canonical form: www or not, trailing slash or not.',
      'Sending http traffic to https once, before HSTS takes over.',
    ],
    notes: 'Browsers and proxies cache this hard, sometimes forever. Reach for 302 or 307 while you are still unsure.',
    related: [302, 308],
    rfc: 'RFC 9110 §15.4.2',
  },
  {
    code: 302,
    name: 'Found',
    summary: 'It lives somewhere else for now.',
    uses: [
      'Sending a signed out visitor to the login page.',
      'Bouncing to a maintenance page while a deploy runs.',
    ],
    notes: 'Clients often turn a POST into a GET when they follow it, which was never the intention. Use 303 when you mean that, and 307 when you do not.',
    related: [303, 307, 301],
    rfc: 'RFC 9110 §15.4.3',
  },
  {
    code: 303,
    name: 'See Other',
    summary: 'The answer is at another address, and fetch it with GET.',
    uses: [
      'Post, redirect, get: after a form is saved, send the browser to the page showing the result.',
      'Pointing at the outcome of a job that was accepted with 202.',
    ],
    notes: 'The one redirect that is meant to change the method to GET. It is what stops a refresh from submitting the form twice.',
    related: [302, 307, 202],
    rfc: 'RFC 9110 §15.4.4',
  },
  {
    code: 304,
    name: 'Not Modified',
    summary: 'What you already have is still good.',
    uses: [
      'Answering a request that carried If-None-Match with a matching ETag.',
      'Answering If-Modified-Since when nothing has changed since then.',
    ],
    notes: 'Send no body. The saving is the whole point, and the client uses its cached copy.',
    related: [200, 412],
    rfc: 'RFC 9110 §15.4.5',
  },
  {
    code: 307,
    name: 'Temporary Redirect',
    summary: 'Somewhere else for now, and keep the method as it was.',
    uses: [
      'Moving a POST to another host during a migration without turning it into a GET.',
      'A temporary redirect where the body and method must survive.',
    ],
    notes: 'The unambiguous version of 302. Use it whenever a non-GET request might be redirected.',
    related: [302, 308],
    rfc: 'RFC 9110 §15.4.8',
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    summary: 'Gone for good, and keep the method as it was.',
    uses: [
      'A permanent move of an API endpoint that takes POSTs.',
      'A canonical redirect that must not quietly turn writes into reads.',
    ],
    notes: 'The unambiguous version of 301. Cached as hard as 301, so be as sure.',
    related: [301, 307],
    rfc: 'RFC 9110 §15.4.9',
  },

  {
    code: 400,
    name: 'Bad Request',
    summary: 'The request itself is malformed.',
    uses: [
      'A body that is not the JSON it claimed to be.',
      'A required field missing, or a query parameter that is not a number.',
    ],
    notes: 'The catch all of the 4xx family, which makes it the least helpful. Reach for 401, 403, 404, 409, 422 or 429 when one of them fits.',
    related: [422, 415],
    rfc: 'RFC 9110 §15.5.1',
  },
  {
    code: 401,
    name: 'Unauthorized',
    summary: 'Who are you? Credentials are missing or no good.',
    uses: [
      'No Authorization header on an endpoint that needs one.',
      'A token that has expired, telling the client to refresh and try again.',
    ],
    notes: 'Named badly: it means unauthenticated. Must carry a WWW-Authenticate header saying how to authenticate.',
    related: [403, 407],
    rfc: 'RFC 9110 §15.5.2',
  },
  {
    code: 402,
    name: 'Payment Required',
    summary: 'Kept aside for payment, and never really standardised.',
    uses: [
      'An API telling a caller their plan has run out of quota.',
      'A paywall, in the handful of services that use it.',
    ],
    notes: 'Reserved since the beginning and still not pinned down. Anything relying on it is relying on its own convention.',
    related: [403, 429],
    rfc: 'RFC 9110 §15.5.3',
  },
  {
    code: 403,
    name: 'Forbidden',
    summary: 'We know who you are, and you still may not.',
    uses: [
      'A signed in user reaching for another account’s record.',
      'An action allowed only to admins.',
      'A request blocked by an IP or country rule.',
    ],
    notes: 'Do not answer 403 when the client is not signed in at all, that is 401. Some services answer 404 instead of 403 to avoid confirming the thing exists.',
    related: [401, 404],
    rfc: 'RFC 9110 §15.5.4',
  },
  {
    code: 404,
    name: 'Not Found',
    summary: 'Nothing lives at this address.',
    uses: [
      'A record id that does not exist, or never did.',
      'A page that was deleted and has no replacement.',
      'Hiding a resource from someone who should not know it exists.',
    ],
    notes: 'Says nothing about whether it ever existed. Use 410 when you want to say it is gone on purpose, and 200 with an empty list for a search that matched nothing.',
    related: [410, 403, 200],
    rfc: 'RFC 9110 §15.5.5',
  },
  {
    code: 405,
    name: 'Method Not Allowed',
    summary: 'That address exists, but not for this verb.',
    uses: [
      'A POST to a read only endpoint.',
      'A DELETE on a collection that only takes GET and POST.',
    ],
    notes: 'Must carry an Allow header listing the methods that do work.',
    related: [501, 404],
    rfc: 'RFC 9110 §15.5.6',
  },
  {
    code: 408,
    name: 'Request Timeout',
    summary: 'The client took too long to say what it wanted.',
    uses: [
      'An idle keep alive connection being closed by the server.',
      'A request body that stopped arriving part way through.',
    ],
    notes: 'About the request being slow, not the work. A slow upstream is 504.',
    related: [504, 503],
    rfc: 'RFC 9110 §15.5.9',
  },
  {
    code: 409,
    name: 'Conflict',
    summary: 'This clashes with how things are right now.',
    uses: [
      'Signing up with an email address someone already used.',
      'An edit based on a version that has since moved on.',
      'Deleting something other records still point at.',
    ],
    notes: 'The one to reach for when the request is valid but the world has changed. Say what clashed, so the client can fix it.',
    related: [412, 422],
    rfc: 'RFC 9110 §15.5.10',
  },
  {
    code: 410,
    name: 'Gone',
    summary: 'It was here, it was taken away, and it is not coming back.',
    uses: [
      'A deprecated API version that has been switched off.',
      'Content removed on purpose, telling crawlers to drop it faster than a 404 would.',
    ],
    notes: 'A stronger claim than 404: you are saying you know it is gone rather than that you cannot find it.',
    related: [404, 301],
    rfc: 'RFC 9110 §15.5.11',
  },
  {
    code: 413,
    name: 'Content Too Large',
    summary: 'The body is bigger than the server will take.',
    uses: [
      'An upload past the size limit.',
      'A batch request with far too many items in it.',
    ],
    notes: 'Often comes from the proxy in front of the app rather than the app, so the limit may not be where you think.',
    related: [414, 400],
    rfc: 'RFC 9110 §15.5.14',
  },
  {
    code: 415,
    name: 'Unsupported Media Type',
    summary: 'The format of the body is not one we take.',
    uses: [
      'XML sent to an endpoint that only reads JSON.',
      'A missing or wrong Content-Type on a POST.',
      'An image format the server will not accept.',
    ],
    notes: 'About the format, not the contents. A well formed JSON body with the wrong fields is 422.',
    related: [422, 400],
    rfc: 'RFC 9110 §15.5.16',
  },
  {
    code: 418,
    name: "I'm a teapot",
    summary: 'The server declines to brew coffee, being a teapot.',
    uses: [
      'An April Fools joke from 1998 that never left.',
      'A honeypot or health check answering something unmistakable.',
    ],
    notes: 'From the Hyper Text Coffee Pot Control Protocol. Not a real HTTP status, and deliberately kept unassigned so it stays a joke.',
    related: [403],
    rfc: 'RFC 2324 §2.3.2',
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    summary: 'We understood it, and it still does not make sense.',
    uses: [
      'Valid JSON where an end date falls before the start date.',
      'A field that parses but fails a business rule.',
    ],
    notes: 'The workhorse of form validation. 400 is for a request that could not be parsed, 422 for one that parsed and was wrong.',
    related: [400, 409],
    rfc: 'RFC 9110 §15.5.21',
  },
  {
    code: 429,
    name: 'Too Many Requests',
    summary: 'Slow down.',
    uses: [
      'A rate limit reached on an API key.',
      'Too many failed login attempts from one address.',
      'A crawler asking faster than the site wants to answer.',
    ],
    notes: 'Send Retry-After so the client knows how long to wait rather than guessing or hammering.',
    related: [503, 403],
    rfc: 'RFC 6585 §4',
  },
  {
    code: 451,
    name: 'Unavailable For Legal Reasons',
    summary: 'Blocked because the law says so.',
    uses: [
      'Content taken down after a legal demand.',
      'A region blocked to comply with sanctions or a court order.',
    ],
    notes: 'The number is a nod to Fahrenheit 451. Meant to carry a link explaining who demanded the block.',
    related: [403],
    rfc: 'RFC 7725',
  },

  {
    code: 500,
    name: 'Internal Server Error',
    summary: 'Something broke and the server has nothing better to say.',
    uses: [
      'An unhandled exception in the application.',
      'A bug that got past validation.',
    ],
    notes: 'Means the fault is ours, not the caller’s, so the caller may retry. Never leak a stack trace with it.',
    related: [502, 503],
    rfc: 'RFC 9110 §15.6.1',
  },
  {
    code: 501,
    name: 'Not Implemented',
    summary: 'The server does not know how to do this at all.',
    uses: [
      'A method the server has never supported, such as PATCH on a plain file server.',
      'A feature stubbed out and not built yet.',
    ],
    notes: 'About the whole server, not one address. 405 is the one where the address exists but the verb does not fit.',
    related: [405],
    rfc: 'RFC 9110 §15.6.2',
  },
  {
    code: 502,
    name: 'Bad Gateway',
    summary: 'The thing behind the proxy answered with nonsense.',
    uses: [
      'An app server that crashed while the load balancer was still routing to it.',
      'An upstream returning a response the proxy cannot parse.',
    ],
    notes: 'Comes from the middle of the chain, so look at what is behind the proxy rather than the proxy itself.',
    related: [503, 504],
    rfc: 'RFC 9110 §15.6.3',
  },
  {
    code: 503,
    name: 'Service Unavailable',
    summary: 'Not right now, try again shortly.',
    uses: [
      'Planned maintenance.',
      'Shedding load when a service is past what it can take.',
      'A container that has started but is not ready to serve.',
    ],
    notes: 'The one 5xx that says the trouble is temporary. Send Retry-After when you have any idea how long.',
    related: [429, 500],
    rfc: 'RFC 9110 §15.6.4',
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    summary: 'The thing behind the proxy never answered.',
    uses: [
      'A database query that ran past the proxy’s patience.',
      'An upstream service that hung.',
    ],
    notes: 'The proxy gave up waiting. The work may still be running behind it, which matters if the request was not safe to repeat.',
    related: [502, 408],
    rfc: 'RFC 9110 §15.6.5',
  },
  {
    code: 505,
    name: 'HTTP Version Not Supported',
    summary: 'That version of HTTP is not spoken here.',
    uses: [
      'A very old or malformed client announcing a version the server will not serve.',
    ],
    notes: 'Rare in practice. Usually a broken client or a scanner rather than anything real.',
    related: [400],
    rfc: 'RFC 9110 §15.6.6',
  },
];

export const statusByCode = (code) => STATUSES.find((status) => status.code === Number(code)) ?? null;

export const classOf = (code) => String(code)[0];

export const searchStatuses = (query, group = 'all') => {
  const want = String(query ?? '').trim().toLowerCase();
  return STATUSES.filter((status) => {
    if (group !== 'all' && classOf(status.code) !== group) return false;
    if (!want) return true;
    const hay = [status.code, status.name, status.summary, status.notes, ...(status.uses ?? [])].join(' ').toLowerCase();
    return hay.includes(want);
  });
};
