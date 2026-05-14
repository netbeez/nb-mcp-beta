/**
 * MCP Resource: NetBeez Ad-hoc Tests Guide
 *
 * Dedicated reference for ad-hoc Iperf/Speed/VoIP/Custom Command tests.
 */

export const AD_HOC_TESTS_URI = "netbeez://ad-hoc-tests";
export const AD_HOC_TESTS_NAME = "NetBeez Ad-hoc Tests Guide";
export const AD_HOC_TESTS_DESCRIPTION =
  "Reference for running ad-hoc Iperf, Network Speed, VoIP, and Custom Command tests and retrieving per-agent results";
export const AD_HOC_TESTS_MIME = "text/markdown";

export const AD_HOC_TESTS_CONTENT = `# NetBeez Ad-hoc Tests Guide

This guide explains how to run ad-hoc multiagent tests and retrieve results from the NetBeez JSON:API.

## Endpoints

1. **Create ad-hoc run**
   - \`POST /multiagent_nb_test_runs/ad_hoc\`
2. **Poll run status + included results**
   - \`GET /multiagent_nb_test_runs?filter[multiagent_nb_test_runs]=<run_id>&include=results\`

Authentication:

\`\`\`
Authorization: Bearer <API_KEY>
Content-Type: application/json
\`\`\`

Use \`type=beta\` query parameter with JSON:API endpoints where required by your instance.

---

## Supported Ad-hoc Test Types

| test_type_id | Name | Execution model |
|---|---|---|
| 5 | Iperf | Agent-to-agent OR many-agents-to-server |
| 7 | Network Speed | Many agents to speedtest provider |
| 8 | VoIP | Agent-to-agent |
| 11 | Custom Command | Script runs on one or more agents (no destination) |

---

## Request Body Shape

\`\`\`json
{
  "data": {
    "type": "multiagent_nb_test_run",
    "attributes": {
      "schedule_type": "ad_hoc"
    },
    "relationships": {
      "agents": {
        "data": [
          { "id": 1001, "type": "agent" },
          { "id": 1002, "type": "agent" }
        ]
      },
      "test_type": {
        "data": { "id": 7, "type": "test_type" }
      }
    }
  }
}
\`\`\`

All test-type specifics are added under \`data.attributes\`.

---

## Per-Test Attributes

### Iperf (test_type_id: 5)

Required:
- \`agent_ids\` relationship data
- Exactly one destination model:
  - Agent-to-agent: \`target_is_agent = <destination_agent_id>\`
  - Agent-to-server: \`target = "<ip_or_fqdn>"\` and \`target_is_agent = 0\`

Common optional attributes:
- \`iperf_time\` (default 10)
- \`iperf_type\` (1=tcp, 2=udp)
- \`iperf_port\` (default 5001)
- \`iperf_version\` (2 or 3, default 3)
- \`parallel_streams\` (default 1)
- \`reverse\` (default false)
- \`bandwidth\` (udp only)

### Network Speed (test_type_id: 7)

Required:
- \`agent_ids\` relationship data

Optional:
- \`speedtest_type\`:
  - 2 = NDT
  - 3 = fast.com
  - 4 = Cloudflare
  - 1 = Ookla
- \`target\` can be an empty string

### VoIP (test_type_id: 8)

Required:
- \`agent_ids\` relationship data
- \`target_is_agent = <destination_agent_id>\`

Optional:
- \`secure\`

### Custom Command (test_type_id: 11)

Required:
- \`agent_ids\` relationship data
- \`custom_command\` script body starting with:
  - \`#!/usr/bin/env bash\` OR
  - \`#!/usr/bin/env python\`
- \`output_schema\` array, e.g.:

\`\`\`json
"output_schema": [
  { "metric": "value", "unit": "int" }
]
\`\`\`

Custom command has no destination target.

---

## Minimal Payload Examples

### Iperf: agent-to-agent

\`\`\`json
{
  "data": {
    "type": "multiagent_nb_test_run",
    "attributes": {
      "schedule_type": "ad_hoc",
      "target_is_agent": 3588,
      "iperf_time": 10,
      "iperf_type": 1,
      "iperf_port": 5001,
      "iperf_version": 3,
      "parallel_streams": 1,
      "reverse": false
    },
    "relationships": {
      "agents": { "data": [{ "id": 3646, "type": "agent" }] },
      "test_type": { "data": { "id": 5, "type": "test_type" } }
    }
  }
}
\`\`\`

### Network Speed: many agents to NDT

\`\`\`json
{
  "data": {
    "type": "multiagent_nb_test_run",
    "attributes": {
      "schedule_type": "ad_hoc",
      "speedtest_type": 2,
      "target": ""
    },
    "relationships": {
      "agents": {
        "data": [
          { "id": 279, "type": "agent" },
          { "id": 280, "type": "agent" }
        ]
      },
      "test_type": { "data": { "id": 7, "type": "test_type" } }
    }
  }
}
\`\`\`

### VoIP: agent-to-agent

\`\`\`json
{
  "data": {
    "type": "multiagent_nb_test_run",
    "attributes": {
      "schedule_type": "ad_hoc",
      "target_is_agent": 3588
    },
    "relationships": {
      "agents": { "data": [{ "id": 3646, "type": "agent" }] },
      "test_type": { "data": { "id": 8, "type": "test_type" } }
    }
  }
}
\`\`\`

### Custom Command: one or more agents

\`\`\`json
{
  "data": {
    "type": "multiagent_nb_test_run",
    "attributes": {
      "schedule_type": "ad_hoc",
      "custom_command": "#!/usr/bin/env bash\\necho \\"value=123\\"",
      "output_schema": [
        { "metric": "value", "unit": "int" }
      ]
    },
    "relationships": {
      "agents": {
        "data": [
          { "id": 3646, "type": "agent" },
          { "id": 3588, "type": "agent" }
        ]
      },
      "test_type": { "data": { "id": 11, "type": "test_type" } }
    }
  }
}
\`\`\`

---

## Polling and Terminal States

After creating a run, poll with:

\`\`\`
GET /multiagent_nb_test_runs?filter[multiagent_nb_test_runs]=<run_id>&include=results
\`\`\`

Typical state progression:

\`\`\`
initialization -> running -> completed
\`\`\`

Failure path:

\`\`\`
initialization -> running -> failed (or error)
\`\`\`

---

## Reading Results

The response contains:
- \`data[0].attributes.state\` (run state)
- \`included[]\` with one \`scheduled_nb_test_result\` per agent

Each \`scheduled_nb_test_result\` typically includes:
- \`relationships.agent.data.id\` (which agent produced this result)
- \`attributes.result_values\`: array of key-value metrics
- \`attributes.error_message\`: null on success, message on failure
- \`attributes.severity\`: alert-style severity marker

Example included result:

\`\`\`json
{
  "id": "720055",
  "type": "scheduled_nb_test_result",
  "attributes": {
    "error_message": null,
    "severity": 6,
    "result_values": [
      { "key": "value", "value": 123.0 }
    ]
  },
  "relationships": {
    "agent": { "data": { "id": "3646", "type": "agent" } },
    "multiagent_nb_test_run": { "data": { "id": "450374", "type": "multiagent_nb_test_run" } }
  }
}
\`\`\`

---

## Common Pitfalls

- For Iperf, use **either** destination agent **or** server target, not both.
- VoIP ad-hoc runs are agent-to-agent only.
- For Custom Command, script shebang is required.
- For Custom Command, \`output_schema\` must align with emitted metric keys.
- Poll until terminal state; don't assume immediate completion for multiagent runs.

---

## References

- Community post: Running Ad-hoc Network Speed Tests through the API  
  https://community.netbeez.net/t/running-ad-hoc-network-speed-tests-through-the-api/110
- Community post: Running Ad-hoc Custom Command Tests through the API  
  https://community.netbeez.net/t/running-ad-hoc-custom-command-tests-through-the-api/318
`;
