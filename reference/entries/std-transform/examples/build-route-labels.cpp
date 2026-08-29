#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Route {
    std::string method;
    std::string path;
};

int main() {
    const std::vector<Route> routes{{"GET", "/health"}, {"POST", "/users"}};
    std::vector<std::string> labels(routes.size());

    std::transform(routes.begin(), routes.end(), labels.begin(),
                   [](const Route& route) {
                       return route.method + " " + route.path;
                   });

    for (const std::string& label : labels) {
        std::cout << label << '\n';
    }
}
