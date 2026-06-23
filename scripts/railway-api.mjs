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
