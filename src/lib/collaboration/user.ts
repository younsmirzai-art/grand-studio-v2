/**
 * Current user for multiplayer (no auth: stored in localStorage).
 * Used for chat attribution, god-eye "who did what", and presence.
 */
const KEY_EMAIL = "grand_studio_user_email";
const KEY_NAME = "grand_studio_user_name";

export function getCurrentUser(): { userEmail: string; userName: string } {
  if (typeof window === "undefined") return { userEmail: "", userName: "Boss" };
  return {
    userEmail: localStorage.getItem(KEY_EMAIL) ?? "",
    userName: localStorage.getItem(KEY_NAME) ?? "Boss",
  };
}

export function setCurrentUser(userEmail: string, userName: string) {
  try {
    if (userEmail) localStorage.setItem(KEY_EMAIL, userEmail);
    else localStorage.removeItem(KEY_EMAIL);
    if (userName) localStorage.setItem(KEY_NAME, userName);
    else localStorage.setItem(KEY_NAME, "Boss");
  } catch {}
}
