#include <iostream>
#include <queue>

int main() {
    std::priority_queue<int> jobs;
    jobs.push(2);
    jobs.push(9);
    jobs.push(4);

    bool first = true;
    while (!jobs.empty()) {
        if (!first) {
            std::cout << ' ';
        }
        std::cout << jobs.top();
        jobs.pop();
        first = false;
    }
    std::cout << '\n';
}
