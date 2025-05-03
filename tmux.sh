if ! tmux has-session -t pcsync 2>/dev/null; then
    tmux new-session -d -s pcsync './pocketbase serve'
fi