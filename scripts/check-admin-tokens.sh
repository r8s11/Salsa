#!/usr/bin/env bash
# Fails if any CSS/TSX/TS file references a var(--admin-*) token
# that is never declared inside src/styles/admin.css.
set -euo pipefail

ADMIN_CSS="src/styles/admin.css"
SRC_DIR="src"

# Declared --admin-* names (bare, no -- prefix)
declared=$(grep -oE -- '--admin-[a-z0-9-]+' "$ADMIN_CSS" | sed 's/^--//' | sort -u)

# Referenced --admin-* names outside admin.css (bare, no -- prefix)
referenced=$(find "$SRC_DIR" \( -name '*.css' -o -name '*.tsx' -o -name '*.ts' \) \
	! -path "$ADMIN_CSS" \
	-exec grep -HoE -- 'var\(--admin-[a-z0-9-]+' {} + |
	grep -oE -- '--admin-[a-z0-9-]+' |
	sed 's/^--//' |
	sort -u)

# Names referenced but not declared
undeclared=$(comm -23 <(echo "$referenced") <(echo "$declared"))

if [ -n "$undeclared" ]; then
	echo "ERROR: undeclared admin token references found:"
	echo "$undeclared" | sed 's/^/  --/'

	echo ""
	echo "Referenced in:"
	for name in $undeclared; do
		find "$SRC_DIR" \( -name '*.css' -o -name '*.tsx' -o -name '*.ts' \) \
			! -path "$ADMIN_CSS" \
			-exec grep -HnE -- "var\\(--${name}\\b" {} + |
			sed 's/^/  /'
	done

	echo ""
	echo "Declared tokens in $ADMIN_CSS:"
	echo "$declared" | sed 's/^/  --/'
	exit 1
fi

echo "✓ All --admin-* token references are declared."
