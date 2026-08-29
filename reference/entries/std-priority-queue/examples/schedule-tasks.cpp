#include <iostream>
#include <queue>
#include <string>
#include <vector>

struct Task {
    int priority;
    std::string name;
};

struct LowerPriority {
    bool operator()(const Task& left, const Task& right) const {
        if (left.priority != right.priority) {
            return left.priority < right.priority;
        }
        return left.name > right.name;
    }
};

int main() {
    std::priority_queue<Task, std::vector<Task>, LowerPriority> tasks;
    tasks.push({2, "deploy"});
    tasks.push({1, "report"});
    tasks.push({3, "incident"});

    while (!tasks.empty()) {
        std::cout << tasks.top().name << '\n';
        tasks.pop();
    }
}
