import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function EquipmentPage() {
  return <ResourcePage resource={resourceByPath["/equipment"]} />;
}
