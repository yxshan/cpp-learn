#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct Request {
    std::string path;
};

int main() {
    std::vector<Request> queue;
    Request request{"/health"};

    queue.push_back(std::move(request));

    std::cout << queue.size() << ' ' << queue.back().path << '\n';
}
