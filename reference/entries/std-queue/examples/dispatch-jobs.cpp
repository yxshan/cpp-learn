#include <iostream>
#include <queue>
#include <string>

int main() {
    std::queue<std::string> jobs;
    jobs.push("compile");
    jobs.push("test");
    jobs.push("package");

    while (!jobs.empty()) {
        std::cout << "dispatch=" << jobs.front() << '\n';
        jobs.pop();
    }
}
