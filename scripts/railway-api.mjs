/**
 * Minimal Railway GraphQL client (no extra deps).
 * https://docs.railway.com/integrations/api/api-cookbook
 */
const ENDPOINT = "https://backboard.railway.com/graphql/v2";

export async function railwayGraphql(token, query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) {
    const msg = body.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(msg || "Railway GraphQL error");
  }
  return body.data;
}

export async function listServices(token, projectId) {
  const data = await railwayGraphql(
    token,
    `query($id: String!) {
      project(id: $id) {
        services { edges { node { id name } } }
      }
    }`,
    { id: projectId }
  );
  return (data.project?.services?.edges ?? []).map((e) => e.node);
}

export async function listProjects(token) {
  const data = await railwayGraphql(
    token,
    `query {
      projects { edges { node { id name } } }
    }`
  );
  return (data.projects?.edges ?? []).map((e) => e.node);
}

export async function getProject(token, projectId) {
  const data = await railwayGraphql(
    token,
    `query($id: String!) {
      project(id: $id) {
        id
        name
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      }
    }`,
    { id: projectId }
  );
  return data.project;
}

export async function createService(token, projectId, name, environmentId) {
  const data = await railwayGraphql(
    token,
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id name }
    }`,
    { input: { projectId, name, environmentId } }
  );
  return data.serviceCreate;
}

export async function upsertVariables(token, { projectId, environmentId, serviceId, variables, skipDeploys = true }) {
  await railwayGraphql(
    token,
    `mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`,
    {
      input: {
        projectId,
        environmentId,
        serviceId,
        variables,
        skipDeploys
      }
    }
  );
}

export async function updateServiceInstance(token, { serviceId, environmentId, input }) {
  await railwayGraphql(
    token,
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId, environmentId, input }
  );
}

export async function deployService(token, { serviceId, environmentId, commitSha = null }) {
  const data = await railwayGraphql(
    token,
    `mutation($serviceId: String!, $environmentId: String!, $commitSha: String) {
      serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha)
    }`,
    { serviceId, environmentId, commitSha: commitSha || null }
  );
  return data.serviceInstanceDeployV2;
}

export async function listRecentDeployments(token, serviceId, first = 5) {
  const data = await railwayGraphql(
    token,
    `query($serviceId: String!, $first: Int!) {
      deployments(input: { serviceId: $serviceId }, first: $first) {
        edges { node { id status createdAt } }
      }
    }`,
    { serviceId, first }
  );
  return (data.deployments?.edges ?? []).map((edge) => edge.node);
}

export async function fetchDeployment(token, deploymentId) {
  const data = await railwayGraphql(
    token,
    `query($id: String!) { deployment(id: $id) { id status createdAt meta } }`,
    { id: deploymentId }
  );
  return data.deployment;
}

export async function fetchBuildLogs(token, deploymentId, limit = 200) {
  const data = await railwayGraphql(
    token,
    `query($deploymentId: String!, $limit: Int) {
      buildLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message }
    }`,
    { deploymentId, limit }
  );
  return data.buildLogs ?? [];
}

export async function fetchRuntimeLogs(token, deploymentId, limit = 200) {
  const data = await railwayGraphql(
    token,
    `query($deploymentId: String!) {
      deploymentLogs(deploymentId: $deploymentId) { timestamp message }
    }`,
    { deploymentId }
  );
  const lines = data.deploymentLogs ?? [];
  return limit > 0 ? lines.slice(-limit) : lines;
}
