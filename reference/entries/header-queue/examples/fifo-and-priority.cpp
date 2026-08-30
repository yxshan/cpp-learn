#include <iostream>
#include <queue>
#include <string>
#include <utility>

int main() {
    std::queue<std::string> arrivals;
    arrivals.push("low");
    arrivals.push("high");

    std::priority_queue<std::pair<int, std::string>> priorities;
    priorities.push({1, "low"});
    priorities.push({2, "high"});

    std::cout << "fifo=" << arrivals.front() << '\n';
    std::cout << "priority=" << priorities.top().second << '\n';
}
