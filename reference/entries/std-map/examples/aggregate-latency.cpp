#include <iostream>
#include <map>
#include <string>
#include <vector>

struct Summary {
    int requests{};
    int total_milliseconds{};
};

int main() {
    const std::vector<std::pair<std::string, int>> samples{
        {"/users", 20}, {"/health", 7}, {"/users", 22}, {"/health", 8}};
    std::map<std::string, Summary> by_path;

    for (const auto& [path, latency] : samples) {
        auto& summary = by_path[path];
        ++summary.requests;
        summary.total_milliseconds += latency;
    }

    for (const auto& [path, summary] : by_path) {
        std::cout << path << ':' << summary.requests << ':'
                  << summary.total_milliseconds << '\n';
    }
}
