#include <iostream>
#include <string>
#include <utility>
#include <vector>

int main() {
    std::string source{"compile"};
    std::vector<std::string> queue;
    queue.push_back(std::move(source));

    std::cout << "queued=" << queue.front() << '\n';
}
