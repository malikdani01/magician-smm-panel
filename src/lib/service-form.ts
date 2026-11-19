export type ServiceKind =
  | "default"
  | "comments"
  | "comments-package"
  | "package"
  | "usernames"
  | "usernames-hashtags"
  | "usernames-list"
  | "hashtag"
  | "username"
  | "media"
  | "answer"
  | "subscription";

export type ServiceForm = {
  kind: ServiceKind;
  comments: boolean;
  usernames: boolean;
  hashtags: boolean;
  username: boolean;
  hashtag: boolean;
  media: boolean;
  answer: boolean;
  subscription: boolean;
  quantityFromLines: boolean;
  hideQuantity: boolean;
};

const EMPTY: ServiceForm = {
  kind: "default",
  comments: false,
  usernames: false,
  hashtags: false,
  username: false,
  hashtag: false,
  media: false,
  answer: false,
  subscription: false,
  quantityFromLines: false,
  hideQuantity: false,
};

/** Match the provider service type, then the name, so extra fields appear on the same service. */
export function serviceForm(type: string, name = ""): ServiceForm {
  const blob = `${type} ${name}`.toLowerCase().replace(/[_-]+/g, " ");
  if (/custom comments package|comments package/.test(blob)) {
    return { ...EMPTY, kind: "comments-package", comments: true, quantityFromLines: true };
  }
  if (/custom comments/.test(blob) || (/custom/.test(blob) && /comment/.test(blob))) {
    return { ...EMPTY, kind: "comments", comments: true, quantityFromLines: true };
  }
  if (/comment likes/.test(blob)) return { ...EMPTY, kind: "username", username: true };
  if (/mentions with hashtags/.test(blob)) return { ...EMPTY, kind: "usernames-hashtags", usernames: true, hashtags: true };
  if (/mentions custom list/.test(blob)) return { ...EMPTY, kind: "usernames-list", usernames: true, quantityFromLines: true };
  if (/mentions hashtag/.test(blob)) return { ...EMPTY, kind: "hashtag", hashtag: true };
  if (/mentions user followers|user followers/.test(blob)) return { ...EMPTY, kind: "username", username: true };
  if (/mentions media likers|media likers/.test(blob)) return { ...EMPTY, kind: "media", media: true };
  if (/\bmentions?\b/.test(blob)) return { ...EMPTY, kind: "usernames", usernames: true };
  if (/\bpoll\b/.test(blob)) return { ...EMPTY, kind: "answer", answer: true };
  if (/subscription/.test(blob)) return { ...EMPTY, kind: "subscription", username: true, subscription: true, hideQuantity: true };
  if (/\bpackage\b/.test(blob) && !/comment/.test(blob)) return { ...EMPTY, kind: "package", hideQuantity: true };
  return EMPTY;
}

export function lineCount(value: string) {
  return value.split(/\n/).map((line) => line.trim()).filter(Boolean).length;
}
