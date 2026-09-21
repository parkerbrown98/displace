interface AvatarProps {
  initials: string;
  tone?: "coral" | "default";
  size?: "default" | "small";
}

export function Avatar({ initials, size = "default", tone = "default" }: AvatarProps) {
  const classes = [
    "avatar",
    size === "small" ? "avatar-small" : "",
    tone === "coral" ? "avatar-coral" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} aria-hidden="true">{initials}</span>;
}