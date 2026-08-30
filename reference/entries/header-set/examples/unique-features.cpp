#include <iostream>
#include <iterator>
#include <set>
#include <string>

int main() {
    const std::set<std::string> features{"web", "api", "cache", "api"};
    for (auto it = features.begin(); it != features.end(); ++it) {
        std::cout << *it << (std::next(it) == features.end() ? '\n' : ' ');
    }
}
