/**
 * MCP Prompt: Run Ad-hoc Test
 *
 * Guided workflow to run and retrieve ad-hoc Iperf/Speed/VoIP/Custom Command tests.
 */

export const RUN_ADHOC_TEST_PROMPT = {
  name: "run-adhoc-test",
  description:
    "Run and retrieve ad-hoc test results for Iperf (5), Network Speed (7), VoIP (8), or Custom Command (11). Includes parameter selection, execution, polling, and per-agent result parsing.",
  arguments: [
    {
      name: "test_type",
      description:
        "Optional test type hint: iperf, speed, voip, or custom_command.",
      required: false,
    },
    {
      name: "agent_hint",
      description:
        "Optional starting hint for source agents (name, ID, or regex-style phrase).",
      required: false,
    },
    {
      name: "destination_hint",
      description:
        "Optional destination hint: destination agent (for iperf/voip) or server IP/FQDN (for iperf).",
      required: false,
    },
  ],
  messages: (args: {
    test_type?: string;
    agent_hint?: string;
    destination_hint?: string;
  }) => {
    const testTypeHint = args.test_type
      ? `User-provided test_type hint: "${args.test_type}".`
      : "No test_type hint provided; infer the best test type from user intent.";
    const agentHint = args.agent_hint
      ? `Agent hint: "${args.agent_hint}".`
      : "No agent hint provided.";
    const destinationHint = args.destination_hint
      ? `Destination hint: "${args.destination_hint}".`
      : "No destination hint provided.";

    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please run an ad-hoc NetBeez test and retrieve results using this workflow.

${testTypeHint}
${agentHint}
${destinationHint}

## Step 1: Resolve source agents (only if needed)
- If the user already provided unambiguous agent IDs/names, use them directly.
- If agent identity is missing or ambiguous, use search_agents and/or list_agents to resolve the correct source agent IDs.
- Build a final agent_ids array with at least one source agent.

## Step 2: Determine test type from intent, then validate
- First infer test type from user intent/wording:
  - "iperf", "throughput between agents/server" -> Iperf (5)
  - "speedtest", "ndt", "fast.com", "cloudflare speed" -> Network Speed (7)
  - "voip", "mos", "jitter voice" -> VoIP (8)
  - "run script", "custom command", "execute bash/python" -> Custom Command (11)
- If still ambiguous, ask one concise clarifying question before execution.
- Supported test types:
  - Iperf: test_type_id 5
  - Network Speed: test_type_id 7
  - VoIP: test_type_id 8
  - Custom Command: test_type_id 11
- Reject unsupported ad-hoc test types (ping/dns/http/traceroute).

## Step 3: Prepare the payload parameters

### Iperf (test_type_id 5)
- Required: agent_ids
- Required destination model: exactly ONE of:
  - destination_agent_id (agent-to-agent), OR
  - target (IP/FQDN server, agent-to-server)
- Optional: iperf_type (tcp|udp), iperf_port, iperf_version (2|3), iperf_time, parallel_streams, reverse, bandwidth (udp only)

### Network Speed (test_type_id 7)
- Required: agent_ids
- Optional: speedtest_type
  - ndt (2), fast/fast.com (3), cloudflare (4), ookla (1)
- No destination agent required

### VoIP (test_type_id 8)
- Required: agent_ids
- Required: destination_agent_id (agent-to-agent only)
- Optional: secure

### Custom Command (test_type_id 11)
- Required: agent_ids
- Required: custom_command (must start with #!/usr/bin/env bash or #!/usr/bin/env python)
- Required: output_schema array with one or more entries:
  - { "metric": "<metric_name>", "unit": "<unit_name>" }
- No destination agent/server needed

## Step 4: Execute
- Call run_adhoc_test with the selected parameters.
- If the tool returns completed results directly, parse them.
- If the run does not complete within timeout, capture the multiagent_nb_test_run_id and continue polling.

## Step 5: Poll when needed
- Use get_multiagent_test_run_status with multiagent_nb_test_run_id.
- Continue until state is completed, failed, or error.

## Step 6: Parse results
- Run state is in data[0].attributes.state (or data.attributes.state for object responses).
- Per-agent results are in included[] where type === "scheduled_nb_test_result".
- For each included result:
  - agent ID: relationships.agent.data.id
  - metrics: attributes.result_values (array of { key, value })
  - error details: attributes.error_message
  - severity: attributes.severity

## Step 7: Return a concise summary
- Show final run state.
- Show per-agent metrics in a readable form.
- Flag failed/error states explicitly and include error_message when present.
- For custom command tests, map result_values keys to output_schema units when possible.`,
        },
      },
    ];
  },
};
