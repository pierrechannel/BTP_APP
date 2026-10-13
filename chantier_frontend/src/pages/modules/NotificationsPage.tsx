import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function NotificationsPage() {
  return <ResourcePage resource={resourceByPath["/notifications"]} />;
}
