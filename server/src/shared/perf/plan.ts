export type ExplainNode = {
  "Node Type"?: string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Total Time"?: number;
  "Plan Rows"?: number;
  Plans?: ExplainNode[];
};

export type ExplainResult = {
  Plan?: ExplainNode;
  "Execution Time"?: number;
  "Planning Time"?: number;
};

export function flattenPlans(node: ExplainNode | undefined): ExplainNode[] {
  if (!node) return [];
  return [node, ...(node.Plans ?? []).flatMap((child) => flattenPlans(child))];
}

export function indexNames(node: ExplainNode | undefined): string[] {
  return flattenPlans(node)
    .map((plan) => plan["Index Name"])
    .filter((name): name is string => Boolean(name));
}

export function nodeTypesOnRelation(node: ExplainNode | undefined, relation: string): string[] {
  return flattenPlans(node)
    .filter((plan) => plan["Relation Name"] === relation)
    .map((plan) => plan["Node Type"] ?? "Unknown");
}

export function usesIndexAccess(node: ExplainNode | undefined, relation: string): boolean {
  return nodeTypesOnRelation(node, relation).some((type) =>
    /Index Scan|Index Only Scan|Bitmap Index Scan|Bitmap Heap Scan/.test(type)
  );
}

export function usesSeqScan(node: ExplainNode | undefined, relation: string): boolean {
  return nodeTypesOnRelation(node, relation).includes("Seq Scan");
}
