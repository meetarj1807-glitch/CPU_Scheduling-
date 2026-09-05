from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

def calculate_steps(head, sequence):
    current = head
    total = 0
    steps = []

    for i, nxt in enumerate(sequence, start=1):
        change = nxt - current
        movement = abs(change)

        if change > 0:
            direction = "Increasing ↑"
        elif change < 0:
            direction = "Decreasing ↓"
        else:
            direction = "No movement"

        total += movement
        steps.append({
            "step": i,
            "from": current,
            "to": nxt,
            "change": change,
            "movement": movement,
            "direction": direction,
            "total": total
        })
        current = nxt

    return {
        "sequence": sequence,
        "steps": steps,
        "movement": total
    }

def sstf(head, requests):
    pending = requests.copy()
    current = head
    sequence = []

    while pending:
        nearest = min(
            pending,
            key=lambda x: (abs(x - current), x)
        )
        sequence.append(nearest)
        current = nearest
        pending.remove(nearest)

    return calculate_steps(head, sequence)

def look(head, requests, direction):
    left = sorted([x for x in requests if x < head])
    right = sorted([x for x in requests if x >= head])

    if direction == "right":
        sequence = right + list(reversed(left))
    else:
        sequence = list(reversed(left)) + right

    return calculate_steps(head, sequence)

def clook(head, requests, direction):
    left = sorted([x for x in requests if x < head])
    right = sorted([x for x in requests if x >= head])

    if direction == "right":
        sequence = right + left
    else:
        sequence = list(reversed(left)) + list(reversed(right))

    return calculate_steps(head, sequence)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json(force=True)

        head = int(data["head"])
        disk_size = int(data["diskSize"])
        requests = [int(x) for x in data["requests"]]
        direction = data.get("direction", "right")

        if disk_size <= 1:
            return jsonify({"error": "Disk size must be greater than 1."}), 400
        if not 0 <= head < disk_size:
            return jsonify({"error": f"Head must be between 0 and {disk_size - 1}."}), 400
        if not requests:
            return jsonify({"error": "Enter at least one request."}), 400
        if any(x < 0 or x >= disk_size for x in requests):
            return jsonify({"error": f"All requests must be between 0 and {disk_size - 1}."}), 400
        if direction not in ("left", "right"):
            return jsonify({"error": "Direction must be left or right."}), 400

        results = {
            "SSTF": sstf(head, requests),
            "LOOK": look(head, requests, direction),
            "C-LOOK": clook(head, requests, direction)
        }

        best = min(results, key=lambda name: results[name]["movement"])

        return jsonify({
            "initial_head": head,
            "disk_size": disk_size,
            "requests": requests,
            "direction": direction,
            "sstf": results["SSTF"],
            "look": results["LOOK"],
            "clook": results["C-LOOK"],
            "best_algorithm": best
        })

    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
